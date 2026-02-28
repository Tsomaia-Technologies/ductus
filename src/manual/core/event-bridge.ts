import { CommittedEvent } from '../interfaces/event.js'
import { LinkedList } from './linked-list.js'
import { TerminateProcessorEvent } from '../events/types.js'

type EventResolver = (event: TerminateProcessorEvent | CommittedEvent) => void

export class EventBridge {
  private readonly eventQueue = new LinkedList<CommittedEvent>()
  private readonly pushResolverQueue = new LinkedList<() => void>()
  private readonly processorResolverQueue = new LinkedList<EventResolver>()
  private isTerminated = false

  async push(event: CommittedEvent): Promise<void> {
    if (this.isTerminated) {
      return
    }

    const resolve = this.processorResolverQueue.removeFirst()

    if (resolve) {
      resolve(event)
      return
    } else {
      this.eventQueue.insertLast(event)

      return await new Promise<void>(resolve => {
        this.pushResolverQueue.insertLast(resolve)
      })
    }
  }

  async *streamEvents(): AsyncIterable<TerminateProcessorEvent | CommittedEvent> {
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
