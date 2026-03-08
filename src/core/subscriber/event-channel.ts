import { HotEventSubscriber } from '../../interfaces/hot-event-subscriber.js'
import { CommittedEvent } from '../../interfaces/event.js'
import { LinkedList } from '../linked-list.js'
import { Disposer } from '../../interfaces/cancellation-token.js'
import { DefaultEventListener } from '../default-event-listener.js'
import { DefaultDeferrer } from '../default-deferrer.js'

export interface BlockingSubscriberOptions {
  name?: string | null
}

export class EventChannel implements HotEventSubscriber {
  private eventQueue = new LinkedList<CommittedEvent>()
  private readonly streamDeferrer = new DefaultDeferrer()
  private readonly drainDeferrer = new DefaultDeferrer()
  private readonly drainListener = new DefaultEventListener()
  private readonly terminationListener = new DefaultEventListener()
  private readonly _name: string | null
  private isTerminationRequested = false
  private isTerminated = false
  private _isConsuming = false

  constructor(options?: BlockingSubscriberOptions) {
    this._name = options?.name ?? null
  }

  name(): string | null {
    return this._name
  }

  isConsuming(): boolean {
    return this._isConsuming
  }

  setConsuming(consuming: boolean) {
    this._isConsuming = consuming
  }

  enqueue(event: CommittedEvent): void {
    if (this.isTerminated || this.isTerminationRequested) return

    this.eventQueue.insertLast(event)
    this.streamDeferrer.wakeUpNext()
  }

  async waitForDrain(): Promise<void> {
    if (this.isTerminated || this.isTerminationRequested) return
    if (this.eventQueue.size === 0) return

    await this.drainDeferrer.sleep()
  }

  async* streamEvents() {
    while (true) {
      if (this.isTerminated) return

      const event = this.eventQueue.removeFirst()

      if (event) {
        yield event

        if (this.isTerminationRequested && this.eventQueue.size === 0) {
          this.close()
          return
        }

        this.drainDeferrer.wakeUpNext()
        this.drainListener.trigger()
      } else {
        if (this.isTerminationRequested) return
        await this.streamDeferrer.sleep()
      }
    }
  }

  unsubscribe({ drain = true }: { drain?: boolean } = {}): CommittedEvent[] {
    this.isTerminationRequested = true

    if (drain && this.eventQueue.size > 0) {
      this.streamDeferrer.wakeUpNext()
      return []
    }

    const events = Array.from(this.eventQueue)
    this.close()

    return events
  }

  onDrain(callback: () => void): Disposer {
    return this.drainListener.on(callback)
  }

  onUnsubscribe(callback: () => void) {
    this.terminationListener.on(callback)
  }

  private close() {
    this.isTerminated = true
    this.streamDeferrer.wakeUpAll()
    this.drainDeferrer.wakeUpAll()
    this.terminationListener.trigger()
    this.eventQueue.clear()
  }
}
