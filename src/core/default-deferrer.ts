import { Deferrer } from '../interfaces/deferrer.js'
import { LinkedList } from './linked-list.js'
import { CancellationToken } from '../interfaces/cancellation-token.js'

export class DefaultDeferrer implements Deferrer {
  private queue = new LinkedList<() => void>()

  isWaiting(): boolean {
    return this.queue.size > 0
  }

  sleep(canceller?: CancellationToken): Promise<void> {
    return new Promise<void>((resolve) => {
      const token = this.queue.insertLast(resolve)
      canceller?.onCancel(() => {
        resolve()
        this.queue.removeByToken(token)
      })
    })
  }

  wakeUpNext(): void {
    this.queue?.removeFirst()?.()
  }

  wakeUpAll(): void {
    let current: (() => void) | null = null

    while (current = this.queue.removeFirst()) {
      current()
    }
  }
}
