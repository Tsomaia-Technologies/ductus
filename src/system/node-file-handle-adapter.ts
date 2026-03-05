import * as fs from 'fs/promises'
import { FileHandleAdapter } from '../interfaces/file-handle-adapter.js'
import { Json } from '../interfaces/json.js'

interface PendingWrite {
    chunk: string
    resolve: () => void
    reject: (err: Error) => void
}

export class NodeFileHandleAdapter implements FileHandleAdapter {
    private handle: fs.FileHandle | null = null
    private isWriting = false
    private writeQueue: PendingWrite[] = []

    async open(absolutePath: string, mode: 'a' | 'w'): Promise<void> {
        if (this.handle) {
            throw new Error('File handle is already open.')
        }
        this.handle = await fs.open(absolutePath, mode)
    }

    async append(data: string | Uint8Array): Promise<void> {
        if (!this.handle) {
            throw new Error('Cannot append. File handle is not open.')
        }

        const chunk = typeof data === 'string' ? data : new TextDecoder().decode(data)

        return new Promise((resolve, reject) => {
            this.writeQueue.push({ chunk, resolve, reject })
            this.flushQueue().catch(reject) // Catch synchronous errors if any
        })
    }

    async appendJsonl(data: Json): Promise<void> {
        const chunk = JSON.stringify(data) + '\n'
        await this.append(chunk)
    }

    private async flushQueue(): Promise<void> {
        // If already writing, or queue is empty, do nothing.
        // The active writer loop will pick up new items in the while loop.
        if (this.isWriting || this.writeQueue.length === 0) return

        this.isWriting = true

        try {
            while (this.writeQueue.length > 0) {
                // Grab current queue and empty it
                const batch = this.writeQueue
                this.writeQueue = []

                // Merge all chunks into one payload
                const mergedData = batch.map(w => w.chunk).join('')

                try {
                    if (this.handle) {
                        await this.handle.appendFile(mergedData)
                    } else {
                        throw new Error('Handle closed during write')
                    }
                    // Resolve all promises that were waiting for this batch
                    for (const pending of batch) {
                        pending.resolve()
                    }
                } catch (error) {
                    // Reject all promises in this batch
                    for (const pending of batch) {
                        pending.reject(error as Error)
                    }
                }
            }
        } finally {
            this.isWriting = false
        }
    }

    async sync(): Promise<void> {
        if (this.handle) {
            await this.handle.sync()
        }
    }

    async close(): Promise<void> {
        if (this.handle) {
            await this.handle.close()
            this.handle = null
        }
    }
}
