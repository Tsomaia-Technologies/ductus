import { BroadcastingContext, Multiplexer } from '../../interfaces/multiplexer.js'
import { EventSubscriber } from '../../interfaces/event-subscriber.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { EventSequencer } from '../../interfaces/event-sequencer.js'
import { EventChannel } from '../subscriber/event-channel.js'
import { Mutex } from '../mutex.js'

export class BlockingMultiplexer implements Multiplexer {
  private readonly subscribers: EventChannel[] = []
  private readonly lockMutex = new Mutex()

  constructor(private readonly sequencer: EventSequencer) {
  }

  subscribe(params?: { name?: string | null }): EventSubscriber {
    const subscriber = new EventChannel({ name: params?.name })
    this.subscribers.push(subscriber)

    subscriber.onUnsubscribe(() => {
      const index = this.subscribers.indexOf(subscriber)
      this.subscribers.splice(index, 1)
    })

    return subscriber
  }

  async broadcast(event: BaseEvent, context?: BroadcastingContext): Promise<CommittedEvent> {
    const sourceSubscriber = context?.sourceSubscriber
    const commitedEvent = await this.sequencer.commit(event, {
      causationId: context?.causationId,
      correlationId: context?.correlationId,
      chainId: context?.chainId,
      sourceSubscriber: context?.sourceSubscriber,
    })

    await this.lockMutex.lock(async () => {
      for (const subscriber of this.subscribers) {
        if (subscriber !== sourceSubscriber) {
          subscriber.enqueue(commitedEvent)
        }
      }
    })

    return commitedEvent
  }

  async waitForConsumers(excludeSubscriber?: EventSubscriber): Promise<void> {
    const targets = this.subscribers.filter(subscriber => {
      return subscriber !== excludeSubscriber && subscriber.isConsuming()
    })

    await Promise.all(targets.map(target => target.waitForDrain()))
  }
}
