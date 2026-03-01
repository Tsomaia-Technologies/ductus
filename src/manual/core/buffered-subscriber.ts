import { CommittedEvent } from '../interfaces/event.js'
import { LinkedList } from './linked-list.js'
import { EventSubscriber } from '../interfaces/event-subscriber.js'

export class BufferedSubscriber implements EventSubscriber<CommittedEvent> {
  private readonly eventQueue = new LinkedList<CommittedEvent>()
  private readonly pushResolverQueue = new LinkedList<() => void>()
  private readonly processorWakeUpQueue = new LinkedList<() => void>()
  private isTerminated = false
  private isPushPending = false

  async push(event: CommittedEvent): Promise<void> {
    if (this.isTerminated) {
      throw new Error('Cannot push to the terminated event bridge')
    }

    if (this.isPushPending) {
      throw new Error('Cannot push, the previous push operation has not been resolved yet')
    }

    this.eventQueue.insertLast(event)
    const wakeUp = this.processorWakeUpQueue.removeFirst()

    if (wakeUp) {
      wakeUp()
      return
    } else {
      this.isPushPending = true

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

        await new Promise<void>(resolve => {
          this.processorWakeUpQueue.insertLast(resolve)
        })
      }
    }
  }

  terminate({ drain = true }: { drain?: boolean }): CommittedEvent[] {
    let wakeUp: (() => void) | null = null
    let releasePush: (() => void) | null = null

    this.isTerminated = true

    while (wakeUp = this.processorWakeUpQueue.removeFirst()) {
      wakeUp()
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
