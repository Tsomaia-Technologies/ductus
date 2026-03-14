export interface AsyncChannel<T> {
  size(): number

  push(item: T): void

  close(): void

  isClosed(): boolean

  stream(): AsyncIterable<T>
}
