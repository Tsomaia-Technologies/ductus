import { BroadcastingContext, Multiplexer } from '../../interfaces/multiplexer.js'
import { EventSequencer } from '../../interfaces/event-sequencer.js'
import { EventChannel } from '../event-channel.js'
import { Mutex } from '../mutex.js'
import { EventSubscriber } from '../../interfaces/event-subscriber.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { BackpressureExceededError } from '../error/backpressure-exceeded-error.js'

export interface FailFirstMultiplexerOptions {
  sequencer: EventSequencer
  maxQueueSize: number
}

export class FailFirstMultiplexer implements Multiplexer {
  private readonly sequencer: EventSequencer
  private readonly subscribers: EventChannel[] = []
  private readonly lockMutex = new Mutex()
  private readonly maxQueueSize: number

  constructor(options: FailFirstMultiplexerOptions) {
    this.sequencer = options.sequencer
    this.maxQueueSize = options.maxQueueSize
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
    return await this.lockMutex.lock(async () => {
      this.checkThresholds()

      const committedEvent = await this.sequencer.commit(event, {
        causationId: context?.causationId,
        correlationId: context?.correlationId,
        chainId: context?.chainId,
        sourceSubscriber: context?.sourceSubscriber,
      })

      for (const subscriber of this.subscribers) {
        subscriber.enqueue(committedEvent)
      }

      return committedEvent
    })
  }

  private checkThresholds(): void {
    for (const subscriber of this.subscribers) {
      if (!subscriber.isConsuming()) continue

      if (subscriber.queueSize >= this.maxQueueSize) {
        throw new BackpressureExceededError(
          subscriber.name(),
          subscriber.queueSize,
          this.maxQueueSize,
        )
      }
    }
  }
}
