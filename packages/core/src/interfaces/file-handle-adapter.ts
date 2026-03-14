import { Json } from './json.js'

export interface FileHandleAdapter {
    /**
     * Opens the file and returns a handle reference.
     * Throws if the file cannot be opened exclusively (if supported by OS).
     *
     * @param {string} absolutePath
     * @param {'a' | 'w'} mode
     */
    open(absolutePath: string, mode: 'a' | 'w'): Promise<void>

    /**
     * Appends an arbitrary text to the open handle.
     *
     * @param {string | Uint8Array} data
     */
    append(data: string | Uint8Array): Promise<void>

    /**
     * Serializes an object to JSON and appends it with a newline.
     *
     * @param {Json} data
     */
    appendJsonl(data: Json): Promise<void>

    /**
     * Flushes any OS-level buffers to physical disk.
     */
    sync(): Promise<void>

    /**
     * Closes the handle, releasing the file lock.
     */
    close(): Promise<void>
}
