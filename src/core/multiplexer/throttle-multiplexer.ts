import { BroadcastingContext, Multiplexer } from '../../interfaces/multiplexer.js'
import { EventSequencer } from '../../interfaces/event-sequencer.js'
import { EventChannel } from '../event-channel.js'
import { Mutex } from '../mutex.js'
import { EventSubscriber } from '../../interfaces/event-subscriber.js'
import { BaseEvent, CommittedEvent } from '../../interfaces/event.js'
import { BackpressureExceededError } from '../error/backpressure-exceeded-error.js'

export interface ThrottleMultiplexerOptions {
  sequencer: EventSequencer
  highWaterMark: number
  lowWaterMark?: number       // default: Math.floor(highWaterMark / 2)
  stallTimeoutMs?: number
}

export class ThrottleMultiplexer implements Multiplexer {
  private readonly sequencer: EventSequencer
  private readonly highWaterMark: number
  private readonly lowWaterMark: number
  private readonly stallTimeoutMs: number
  private readonly subscribers: EventChannel[] = []
  private readonly lockMutex = new Mutex()

  constructor(options: ThrottleMultiplexerOptions) {
    this.sequencer = options.sequencer
    this.highWaterMark = options.highWaterMark
    this.lowWaterMark = options.lowWaterMark ?? this.getLowWaterMark(this.highWaterMark)
    this.stallTimeoutMs = options.stallTimeoutMs ?? Infinity
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
    await this.throttle()

    return await this.lockMutex.lock(async () => {
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

  private async throttle(): Promise<void> {
    while (true) {
      const overloaded = this.subscribers.find(subscriber => {
        return subscriber.isConsuming() && subscriber.queueSize >= this.highWaterMark
      })

      if (!overloaded) return

      await this.waitForRecovery(overloaded) // Pause until this subscriber recovers
      // Loop: re-check in case another subscriber went over while we waited
    }
  }

  private waitForRecovery(subscriber: EventChannel): Promise<void> {
    if (subscriber.queueSize <= this.lowWaterMark)
      return Promise.resolve()

    return new Promise<void>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined

      const done = () => {
        if (timer) clearTimeout(timer)
        unsubscribeDrain()
        resolve()
      }

      const unsubscribeDrain = subscriber.onDrain(() => {
        if (subscriber.queueSize <= this.lowWaterMark) {
          done()
        }
      })

      subscriber.onUnsubscribe(done)

      if (this.stallTimeoutMs !== Infinity) {
        timer = setTimeout(() => {
          unsubscribeDrain()
          reject(new BackpressureExceededError(
            subscriber.name(),
            subscriber.queueSize,
            this.highWaterMark,
          ))
        }, this.stallTimeoutMs)
      }
    })
  }

  private getLowWaterMark(highWaterMark: number): number {
    return Math.floor(highWaterMark / 2)
  }
}
