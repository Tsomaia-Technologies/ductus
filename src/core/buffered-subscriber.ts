import { LinkedList } from './linked-list.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'
import { CommittedEvent } from '../interfaces/event.js'

export interface BufferedSubscriberOptions {
  bufferLimit?: number
}

export class BufferedSubscriber implements EventSubscriber {
  private readonly eventQueue = new LinkedList<CommittedEvent>()
  private readonly processorWakeUpQueue = new LinkedList<() => void>()
  private readonly terminationListeners: Array<() => void> = []
  private isTerminated = false
  private readonly bufferLimit: number

  constructor(options?: BufferedSubscriberOptions) {
    this.bufferLimit = options?.bufferLimit ?? 10000
  }

  async push(event: CommittedEvent): Promise<void> {
    if (this.isTerminated) {
      return
    }

    if (this.eventQueue.size >= this.bufferLimit) {
      throw new Error(`Subscriber buffer overflow. Limit of ${this.bufferLimit} events reached. Consumer is deadlocked or too slow.`)
    }

    this.eventQueue.insertLast(event)

    const wakeUp = this.processorWakeUpQueue.removeFirst()
    wakeUp?.()

    return Promise.resolve()
  }

  async* streamEvents(): AsyncIterable<CommittedEvent> {
    while (true) {
      const event = this.eventQueue.removeFirst()

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
