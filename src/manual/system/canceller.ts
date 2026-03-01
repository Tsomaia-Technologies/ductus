import { CancellationToken, Disposer } from '../interfaces/cancellation-token.js'

export interface CancellerOptions {
  base?: CancellationToken
  forceByDefault?: boolean
}

export class Canceller implements CancellationToken {
  private readonly cancellationListeners: Array<(force: boolean) => void> = []
  private readonly forceByDefault: boolean
  private cancelled = false

  constructor(options: CancellerOptions = { forceByDefault: false }) {
    const { base, forceByDefault = false } = options
    this.forceByDefault = forceByDefault
    base?.onCancel((force) => this.cancel({ force }))
  }

  isCancelled(): boolean {
    return this.cancelled
  }

  cancel({ force }: { force?: boolean }): void {
    this.cancellationListeners.forEach(listener => {
      listener(force ?? this.forceByDefault)
    })
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
