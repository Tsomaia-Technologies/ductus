import { CancellationToken, Disposer } from '../interfaces/cancellation-token.js'

export interface CancellerOptions {
  base?: CancellationToken
  forceByDefault?: boolean
}

export class Canceller implements CancellationToken {
  private readonly cancellationListeners: Array<(force: boolean) => void> = []
  private readonly forceByDefault: boolean
  private readonly base?: CancellationToken
  private cancelled = false

  constructor(options: CancellerOptions = { forceByDefault: false }) {
    const { base, forceByDefault = false } = options
    this.forceByDefault = forceByDefault
    this.base = base
    base?.onCancel((force) => this.cancel({ force }))
  }

  isCancelled(): boolean {
    return this.cancelled
  }

  cancel({ force }: { force?: boolean } = {}): void {
    if (this.cancelled) return
    this.cancelled = true
    this.cancellationListeners.forEach(listener => {
      listener(force ?? this.forceByDefault)
    })
    this.base?.cancel({ force })
  }

  onCancel(callback: (force: boolean) => void): Disposer {
    this.cancellationListeners.push(callback)

    return () => {
      this.cancellationListeners.splice(
        this.cancellationListeners.indexOf(callback),
        1,
      )
    }
  }
}
