export interface CancellationToken {
  isCancelled(): boolean
  onCancel(): Promise<void>
  cancel(): void
}
