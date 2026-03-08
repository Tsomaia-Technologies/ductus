import { BroadcastingContext, Multiplexer } from '../../interfaces/multiplexer.js'
import { EventSubscriber } from '../../interfaces/event-subscriber.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { EventSequencer } from '../../interfaces/event-sequencer.js'
import { BlockingSubscriber } from '../subscriber/blocking-subscriber.js'
import { Mutex } from '../mutex.js'

export class BlockingMultiplexer implements Multiplexer {
  private readonly subscribers: BlockingSubscriber[] = []
  private readonly lockMutex = new Mutex()

  constructor(private readonly sequencer: EventSequencer) {
  }

  subscribe(params?: { name?: string | null }): EventSubscriber {
    const subscriber = new BlockingSubscriber({ name: params?.name })
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

    const promises = await this.lockMutex.lock(async () => {
      const otherSubscribers = this.subscribers.filter(subscriber => {
        return subscriber !== sourceSubscriber
      })

      return otherSubscribers.map(subscriber => subscriber.push(commitedEvent))
    })

    await Promise.all(promises)

    return commitedEvent
  }
}
