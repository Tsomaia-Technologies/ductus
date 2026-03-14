import { BroadcastingContext, Multiplexer } from '../../interfaces/multiplexer.js'
import { EventSubscriber } from '../../interfaces/event-subscriber.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { EventSequencer } from '../../interfaces/event-sequencer.js'
import { EventChannel } from '../event-channel.js'
import { Mutex } from '../mutex.js'

// When you need deterministic ordering between producers and consumers:
// e.g. debugging, tests, pipelines where "event N+1 must not be produced until event N is fully processed by everyone".
// Also when memory is constrained — zero buffering by design.
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
    const commited = await this.lockMutex.lock(async () => {
      const commitedEvent = await this.sequencer.commit(event, {
        causationId: context?.causationId,
        correlationId: context?.correlationId,
        chainId: context?.chainId,
        sourceSubscriber: context?.sourceSubscriber,
      })

      for (const subscriber of this.subscribers) {
        subscriber.enqueue(commitedEvent)
      }

      return commitedEvent
    })

    await this.waitForConsumers()

    return commited
  }

  private async waitForConsumers(): Promise<void> {
    const targets = this.subscribers.filter(subscriber => subscriber.isConsuming())
    await Promise.all(targets.map(target => target.waitForDrain()))
  }
}
