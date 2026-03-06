import { LedgerFileAdapter } from '../interfaces/ledger-file-adapter.js'
import { Json } from '../interfaces/json.js'
import { NodeFileAdapter } from './node-file-adapter.js'

export class NodeLedgerFileAdapter extends NodeFileAdapter implements LedgerFileAdapter {
    async* readLinesJsonlAfter(absolutePath: string, sequence: number): AsyncIterable<Json> {
        const lines = this.readLines(absolutePath)
        let currentLine = 0

        for await (const line of lines) {
            ++currentLine
            const trimmed = line.trim()
            if (!trimmed.length) continue

            try {
                const parsed = JSON.parse(trimmed)
                if (parsed && typeof parsed === 'object' && 'sequenceNumber' in parsed) {
                    if ((parsed as any).sequenceNumber <= sequence) {
                        continue
                    }
                }
                yield parsed
            } catch (error: any) {
                throw new Error(`Corrupted JSON found in ${absolutePath} at line ${currentLine}: ${error?.message}`)
            }
        }
    }
}
