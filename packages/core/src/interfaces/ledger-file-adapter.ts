import { FileAdapter } from './file-adapter.js'
import { Json } from './json.js'

export interface LedgerFileAdapter extends FileAdapter {
    readLinesJsonlAfter(absolutePath: string, sequence: number): AsyncIterable<Json>
    readLastLineJsonl(absolutePath: string): Promise<Json | null>
}
