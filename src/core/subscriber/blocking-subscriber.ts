import { HotEventSubscriber } from '../../interfaces/hot-event-subscriber.js'
import { CommittedEvent } from '../../interfaces/event.js'
import { LinkedList } from '../linked-list.js'
import { Disposer } from '../../interfaces/cancellation-token.js'
import { DefaultEventListener } from '../default-event-listener.js'

export interface BlockingSubscriberOptions {
  name?: string | null
}

export class BlockingSubscriber implements HotEventSubscriber {
  private eventQueue = new LinkedList<CommittedEvent>()
  private streamWakeUpQueue = new LinkedList<() => void>()
  private readonly drainListener = new DefaultEventListener()
  private readonly terminationListener = new DefaultEventListener()
  private readonly _name: string | null
  private isTerminated = false

  constructor(options?: BlockingSubscriberOptions) {
    this._name = options?.name ?? null
  }

  name(): string | null {
    return this._name
  }

  async push(event: CommittedEvent): Promise<void> {
    if (this.isTerminated) return

    await this.drainListener.wait()
    this.eventQueue.insertLast(event)
    this.streamWakeUpQueue.removeFirst()?.()
  }

  async* streamEvents() {
    while (true) {
      const event = this.eventQueue.removeFirst()

      if (event) {
        yield event
        this.drainListener.trigger()
      } else {
        if (this.isTerminated) return

        await new Promise<void>(resolve => {
          this.streamWakeUpQueue.insertLast(resolve)
        })
      }
    }
  }

  isFull(): boolean {
    return false
  }

  unsubscribe({ drain = true }: { drain?: boolean } = {}): CommittedEvent[] {
    let wakeUp: (() => void) | null = null

    this.isTerminated = true

    while (wakeUp = this.streamWakeUpQueue.removeFirst()) {
      wakeUp()
    }

    let discardedEvents: CommittedEvent[] = []

    if (!drain) {
      discardedEvents = this.eventQueue.toArray()
      this.eventQueue.clear()
    }

    this.terminationListener.trigger()

    return discardedEvents
  }

  onDrain(callback: () => void): Disposer {
    return this.drainListener.on(callback)
  }

  onUnsubscribe(callback: () => void) {
    this.terminationListener.on(callback)
  }
}
