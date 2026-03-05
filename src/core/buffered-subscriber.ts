import { LinkedList } from './linked-list.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'
import { CommittedEvent } from '../interfaces/event.js'

export class BufferedSubscriber implements EventSubscriber {
  private readonly eventQueue = new LinkedList<CommittedEvent>()
  private readonly pushResolverQueue = new LinkedList<() => void>()
  private readonly processorWakeUpQueue = new LinkedList<() => void>()
  private readonly terminationListeners: Array<() => void> = []
  private isTerminated = false
  private isPushPending = false

  async push(event: CommittedEvent): Promise<void> {
    if (this.isTerminated) {
      throw new Error('Cannot push to the terminated event bridge')
    }

    if (this.isPushPending) {
      throw new Error('Cannot push, the previous push operation has not been resolved yet')
    }

    this.isPushPending = true
    this.eventQueue.insertLast(event)

    return new Promise<void>(resolve => {
      this.pushResolverQueue.insertLast(() => {
        this.isPushPending = false
        resolve()
      })

      const wakeUp = this.processorWakeUpQueue.removeFirst()
      wakeUp?.()
    })
  }

  async* streamEvents(): AsyncIterable<CommittedEvent> {
    while (true) {
      const event = this.eventQueue.removeFirst()

      if (event) {
        yield event
        const releasePush = this.pushResolverQueue.removeFirst()
        releasePush?.()
      } else {
        if (this.isTerminated) return

        await new Promise<void>(resolve => {
          this.processorWakeUpQueue.insertLast(resolve)
        })
      }
    }
  }

  unsubscribe({ drain = true }: { drain?: boolean }): CommittedEvent[] {
    let wakeUp: (() => void) | null = null
    let releasePush: (() => void) | null = null

    this.isTerminated = true

    while (wakeUp = this.processorWakeUpQueue.removeFirst()) {
      wakeUp()
    }

    while (releasePush = this.pushResolverQueue.removeFirst()) {
      releasePush()
    }

    this.isPushPending = false

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
