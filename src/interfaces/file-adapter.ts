import { FileHandleAdapter } from './file-handle-adapter.js'
import { Json } from './json.js'

export interface FileAdapter {
  /**
   * Checks if file/directory exists at the given path
   *
   * @param {string} absolutePath
   */
  exists(absolutePath: string): Promise<boolean>

  /**
   * Reads a file at the given path or returns null if it does not exist.
   *
   * @param {string} absolutePath
   */
  read(absolutePath: string): Promise<string | null>

  /**
   * Reads a file at the given path or returns {fallback} if it does not exist.
   *
   * @param {string} absolutePath
   * @param {string} fallback
   */
  read(absolutePath: string, fallback: string): Promise<string>

  /**
   * Reads a file at the given path or returns {fallback} or null if it does not exist.
   *
   * @param {string} absolutePath
   * @param {string|null} fallback
   */
  read(absolutePath: string, fallback?: string | null): Promise<string | null>

  /**
   * Returns parsed JSON content of a file at the given path or null if it does not exist.
   *
   * @param {string} absolutePath
   */
  readJson(absolutePath: string): Promise<Json | null>

  /**
   Returns parsed JSON content of a file at the given path or {fallback} if it does not exist.
   *
   * @param {string} absolutePath
   * @param {string} fallback
   */
  readJson(absolutePath: string, fallback: Json): Promise<Json>

  /**
   Returns parsed JSON content of a file at the given path or {fallback} or null if it does not exist.
   *
   * @param {string} absolutePath
   * @param {string} fallback
   */
  readJson(absolutePath: string, fallback?: null): Promise<Json | null>

  /**
   * Reads file line-by-line at the given path
   *
   * @param {string} absolutePath
   */
  readLines(absolutePath: string): AsyncIterable<string>

  /**
   * Returns parsed JSONL lines at the given path
   *
   * @param {string} absolutePath
   */
  readLinesJsonl(absolutePath: string): AsyncIterable<Json>

  /**
   * Writes an arbitrary text to a file in utf-8 format.
   * Returns false if the file is already being used.
   *
   * @param {string} absolutePath
   * @param {string} content
   */
  write(absolutePath: string, content: string): Promise<boolean>

  /**
   * Writes serialized JSON content to a file in utf-8 format.
   * Returns false if the file is already being used.
   *
   * @param {string} absolutePath
   * @param {string} content
   */
  writeJson(absolutePath: string, content: Json): Promise<boolean>

  /**
   * Appends an arbitrary text to a file
   *
   * @param {string} absolutePath
   * @param {string} content
   */
  append(absolutePath: string, content: string): Promise<void>

  /**
   * Appends an arbitrary text to a file followed by a new line
   *
   * @param {string} absolutePath
   * @param {string} content
   */
  appendLine(absolutePath: string, content: string): Promise<void>

  /**
   * Appends serialized JSON text to a file followed by a new line
   *
   * @param {string} absolutePath
   * @param {string} content
   */
  appendLineJsonl(absolutePath: string, content: Json): Promise<void>

  /**
   * Creates a directory if ancestors exist
   *
   * @param {string} absolutePath
   */
  createDirectory(absolutePath: string): Promise<boolean>

  /**
   * Recursively creates directories at every level of the path
   *
   * @param {string} absolutePath
   */
  createDirectoryRecursive(absolutePath: string): Promise<void>

  /**
   * Deletes a file/directory at the given path
   *
   * @param {string} absolutePath
   */
  delete(absolutePath: string): Promise<boolean>

  /**
   * Creates and opens a stateful file handle adapter.
   *
   * @param {string} absolutePath
   * @param {'a' | 'w'} mode
   */
  open(absolutePath: string, mode: 'a' | 'w'): Promise<FileHandleAdapter>
}
