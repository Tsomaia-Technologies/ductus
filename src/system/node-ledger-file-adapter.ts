import * as fs from 'fs'
import { LedgerFileAdapter } from '../interfaces/ledger-file-adapter.js'
import { Json } from '../interfaces/json.js'
import { NodeFileAdapter } from './node-file-adapter.js'

export class NodeLedgerFileAdapter extends NodeFileAdapter implements LedgerFileAdapter {
    async* readLinesJsonlAfter(absolutePath: string, sequence: number): AsyncIterable<Json> {
        let fh: fs.promises.FileHandle | null = null
        try {
            fh = await fs.promises.open(absolutePath, 'r')
            const fd = fh.fd
            const stats = await fh.stat()
            const fileSize = stats.size

            if (fileSize === 0) return

            const chunkSize = 64 * 1024 // 64KB chunks
            let position = fileSize
            let buffer = Buffer.alloc(chunkSize)
            let leftover = ''
            let foundOffset = 0
            let linesToYield: string[] = []

            // 1. Read backwards to find the exact byte offset where sequence is met
            while (position > 0) {
                const readSize = Math.min(position, chunkSize)
                position -= readSize
                await new Promise<void>((resolve, reject) => {
                    fs.read(fd!, buffer, 0, readSize, position, (err, bytesRead) => {
                        if (err) reject(err)
                        else resolve()
                    })
                })

                const chunkStr = buffer.toString('utf-8', 0, readSize)
                const currentStr = chunkStr + leftover
                const lines = currentStr.split('\n')

                // The first item in `lines` might be incomplete if it crosses the chunk boundary.
                leftover = position > 0 ? lines.shift() || '' : ''

                // Process lines in reverse order
                for (let i = lines.length - 1; i >= 0; i--) {
                    const line = lines[i].trim()
                    if (!line) continue

                    // Simple string match for performance, avoids JSON.parse cost during scan
                    const seqMatch = line.match(/"sequenceNumber"\s*:\s*(\d+)/)
                    if (seqMatch) {
                        const lineSeq = parseInt(seqMatch[1], 10)
                        if (lineSeq <= sequence) {
                            // We found the target sequence or earlier.
                            // The start of the *next* line is our byte offset target.
                            // But since we are reading chunks backwards, it's easier to just store
                            // the lines we ALREADY passed while searching, then stream the rest forward.
                            foundOffset = position // fallback, but we'll use linesToYield
                            break
                        } else {
                            // This line is > sequence, we need to yield it eventually
                            linesToYield.unshift(line)
                        }
                    }
                }

                if (foundOffset > 0 || leftover === '') {
                    break // Stop if we found it, or if we hit the very beginning cleanly
                }
            }

            // Yield the lines we already scanned that were > sequence
            let currentLine = 0
            for (const line of linesToYield) {
                ++currentLine
                try {
                    yield JSON.parse(line)
                } catch (error: any) {
                    throw new Error(`Corrupted JSON found in ${absolutePath} (tail lines): ${error?.message}`)
                }
            }

            // If we found the offset in the middle of a chunk, we'd theoretically need to seek forward.
            // But because we stored all valid lines in `linesToYield` during the reverse scan,
            // we don't actually need to open a forward stream unless `sequence` wasn't found at all.
            // In a properly maintained ledger, snapshot sequence + 1 is always near the end.

        } catch (err: any) {
            if (err.code !== 'ENOENT') {
                throw err
            }
        } finally {
            if (fh !== null) {
                await fh.close()
            }
        }
    }
}
