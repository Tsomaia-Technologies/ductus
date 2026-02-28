import { CommittedEvent } from '../interfaces/event.js'
import { LinkedList } from './linked-list.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'

type EventResolver = (event: CommittedEvent) => void

export class BufferedSubscriber implements EventSubscriber<CommittedEvent> {
  private readonly eventQueue = new LinkedList<CommittedEvent>()
  private readonly pushResolverQueue = new LinkedList<() => void>()
  private readonly processorResolverQueue = new LinkedList<EventResolver>()
  private isTerminated = false
  private isPushPending = false

  async push(event: CommittedEvent): Promise<void> {
    if (this.isTerminated) {
      throw new Error('Cannot push to the terminated event bridge')
    }

    if (this.isPushPending) {
      throw new Error('Cannot push, the previous push operation has not been resolved yet')
    }

    const resolve = this.processorResolverQueue.removeFirst()

    if (resolve) {
      resolve(event)
      return
    } else {
      this.isPushPending = true
      this.eventQueue.insertLast(event)

      return await new Promise<void>(resolve => {
        this.pushResolverQueue.insertLast(() => {
          this.isPushPending = false
          resolve()
        })
      })
    }
  }

  async *streamEvents(): AsyncIterable<CommittedEvent> {
    while (true) {
      const event = this.eventQueue.removeFirst()

      if (event) {
        const releasePush = this.pushResolverQueue.removeFirst()
        releasePush?.()
        yield event
      } else {
        if (this.isTerminated) return

        yield await new Promise(resolve => {
          this.processorResolverQueue.insertLast(resolve)
        })
      }
    }
  }

  terminate(drain = true): CommittedEvent[] {
    let resolveProcessor: EventResolver | null = null
    let releasePush: (() => void) | null = null

    this.isTerminated = true

    while (resolveProcessor = this.processorResolverQueue.removeFirst()) {
      resolveProcessor({
        type: 'terminate-processor',
        payload: undefined,
        authorId: 'system',
        volatility: 'volatile',
        timestamp: Date.now(),

        eventId: '',
        sequenceNumber: -1,
        prevHash: '',
        isCommited: true,
        hash: '',
      })
    }

    while (releasePush = this.pushResolverQueue.removeFirst()) {
      releasePush()
    }

    if (!drain) {
      const queue = this.eventQueue.toArray()
      this.eventQueue.clear()

      return queue
    }

    return []
  }
}
