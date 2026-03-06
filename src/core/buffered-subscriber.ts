import { LinkedList } from './linked-list.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'
import { CommittedEvent } from '../interfaces/event.js'

export interface BufferedSubscriberOptions {
  bufferLimit?: number
  bufferTimeoutMs?: number
  overflowStrategy?: 'fail' | 'block'
}

export class BufferedSubscriber implements EventSubscriber {
  private readonly eventQueue = new LinkedList<CommittedEvent>()
  private readonly processorWakeUpQueue = new LinkedList<() => void>()
  private readonly terminationListeners: Array<() => void> = []
  private isTerminated = false
  private readonly bufferLimit: number
  private readonly bufferTimeoutMs: number
  private readonly overflowStrategy: 'fail' | 'block'
  private readonly bufferDrainWakeUpQueue = new LinkedList<{ resolve: () => void, reject: (err: Error) => void, timer: NodeJS.Timeout }>()

  constructor(options?: BufferedSubscriberOptions) {
    this.bufferLimit = options?.bufferLimit ?? 10000
    this.bufferTimeoutMs = options?.bufferTimeoutMs ?? 5000
    this.overflowStrategy = options?.overflowStrategy ?? 'fail'
  }

  async push(event: CommittedEvent): Promise<void> {
    if (this.isTerminated) {
      return
    }

    if (this.eventQueue.size >= this.bufferLimit) {
      if (this.overflowStrategy === 'fail') {
        throw new Error(`Fatal: Subscriber buffer overflow. Limit of ${this.bufferLimit} events reached. Consumer is too slow or deadlocked.`)
      }

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.isTerminated = true
          reject(new Error(`Fatal: Subscriber buffer overflow. Limit of ${this.bufferLimit} events reached and timeout of ${this.bufferTimeoutMs}ms exceeded.`))
        }, this.bufferTimeoutMs)

        this.bufferDrainWakeUpQueue.insertLast({ resolve, reject, timer })
      })
    }

    this.eventQueue.insertLast(event)

    const wakeUp = this.processorWakeUpQueue.removeFirst()
    wakeUp?.()

    return Promise.resolve()
  }

  async* streamEvents(): AsyncIterable<CommittedEvent> {
    while (true) {
      const event = this.eventQueue.removeFirst()

      // Wake up a blocked producer if queue space freed up
      const bufferWaiter = this.bufferDrainWakeUpQueue.removeFirst()
      if (bufferWaiter) {
        clearTimeout(bufferWaiter.timer)
        bufferWaiter.resolve()
      }

      if (event) {
        yield event
      } else {
        if (this.isTerminated) return

        await new Promise<void>(resolve => {
          this.processorWakeUpQueue.insertLast(resolve)
        })
      }
    }
  }

  unsubscribe({ drain = true }: { drain?: boolean } = {}): CommittedEvent[] {
    let wakeUp: (() => void) | null = null

    this.isTerminated = true

    while (wakeUp = this.processorWakeUpQueue.removeFirst()) {
      wakeUp()
    }

    let bufferWaiter: any
    while (bufferWaiter = this.bufferDrainWakeUpQueue.removeFirst()) {
      clearTimeout(bufferWaiter.timer)
      bufferWaiter.resolve() // Unblock any pending producers immediately since we're terminating anyway
    }

    let discardedEvents: CommittedEvent[] = []

    if (!drain) {
      discardedEvents = this.eventQueue.toArray()
      this.eventQueue.clear()
    }

    this.terminationListeners.forEach(listener => listener())

    return discardedEvents
  }

  onUnsubscribe(callback: () => void) {
    this.terminationListeners.push(callback)
  }
}
