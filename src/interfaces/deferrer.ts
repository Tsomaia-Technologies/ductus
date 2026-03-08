import { CancellationToken } from './cancellation-token.js'

export interface Deferrer {
  isWaiting(): boolean
  sleep(canceller?: CancellationToken): Promise<void>
  wakeUpNext(): void
  wakeUpAll(): void
}
