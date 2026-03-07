import { RequestIntent, ResponseIntent } from './intents.js'
import { BroadcastingContext, Multiplexer } from '../interfaces/multiplexer.js'
import { CancellationToken, Disposer } from '../interfaces/cancellation-token.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { clearTimeout } from 'node:timers'
import { HotEventSubscriber } from '../interfaces/hot-event-subscriber.js'

export class IntentProcessor {
  constructor(private readonly multiplexer: Multiplexer) {
  }

  async process(
    eventsIn: AsyncIterable<CommittedEvent>,
    processor: (eventsIn: AsyncIterable<CommittedEvent>) => AsyncIterable<BaseEvent | undefined>,
    canceller: CancellationToken,
    sourceSubscriber?: HotEventSubscriber,
  ): Promise<void> {
    let nextValue: unknown | undefined = undefined
    let trigger = {
      current: undefined as CommittedEvent | undefined,
    }

    const chainedEventsIn = (async function* () {
      for await (const event of eventsIn) {
        trigger.current = event
        yield event
      }
    })()

    const eventsOut = processor(chainedEventsIn)[Symbol.asyncIterator]()

    while (true) {
      if (canceller.isCancelled()) break

      const { value: event, done } = await eventsOut.next(nextValue)

      if (done) break
      if (!event) continue

      const context: BroadcastingContext = {
        causationId: trigger.current?.eventId,
        correlationId: trigger.current?.correlationId ?? trigger.current?.eventId,
        sourceSubscriber,
      }

      if (event.volatility !== 'intent') {
        if (!event) continue
        await this.multiplexer.broadcast(event, context)
        nextValue = undefined
      } else {
        nextValue = await this.processIntent(event, context)
      }
    }
  }

  private async processIntent(intent: BaseEvent, context: BroadcastingContext) {
    if (RequestIntent.is(intent)) {
      const { event, response, timeoutMs } = intent.payload
      const chainId = crypto.randomUUID()
      const responsePromise = new Promise<CommittedEvent>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined = undefined
        let unsubscribe: Disposer | undefined = undefined

        if (timeoutMs != null) {
          timer = setTimeout(() => {
            unsubscribe?.()
            reject(new Error(`RequestedIntent timeout after ${timeoutMs}ms`))
          }, timeoutMs)
        }

        const predicate = typeof response === 'string'
          ? ((event: BaseEvent) => event.type === response)
          : ((event: BaseEvent) => event.type === response.type)

        unsubscribe = this.multiplexer.onCommit(event => {
          if (event.chainId === chainId && predicate(event)) {
            if (timer) clearTimeout(timer)
            unsubscribe?.()
            resolve(event)
          }
        })
      })

      await this.multiplexer.broadcast(event, {
        ...context,
        chainId,
      })

      return await responsePromise
    } else if (ResponseIntent.is(intent)) {
      const { request, response } = intent.payload

      await this.multiplexer.broadcast(response, {
        chainId: request.chainId,
        causationId: request.eventId,
        correlationId: request.correlationId ?? request.eventId,
        sourceSubscriber: context.sourceSubscriber,
      })

      return undefined
    }
  }
}
