export type Disposer = () => void

export interface CancellationToken {
  isCancelled(): boolean

  onCancel(callback: (force: boolean) => void): Disposer

  cancel(params?: { force?: boolean }): void
}
