import { RequestIntent } from './intents.js'
import { Multiplexer } from '../interfaces/multiplexer.js'
import { CancellationToken, Disposer } from '../interfaces/cancellation-token.js'
import { BaseEvent, CommittedEvent } from '../interfaces/event.js'
import { clearTimeout } from 'node:timers'

export class IntentProcessor {
  constructor(private readonly multiplexer: Multiplexer) {
  }

  async process(
    eventsOut: AsyncIterator<BaseEvent | undefined>,
    canceller: CancellationToken,
  ): Promise<void> {
    let nextValue: unknown | undefined = undefined

    while (true) {
      if (canceller.isCancelled()) break

      const { value: event, done } = await eventsOut.next(nextValue)

      if (done) break
      if (!event) continue

      if (event.volatility !== 'intent') {
        if (!event) continue
        await this.multiplexer.broadcast(event)
      } else {
        await this.processIntent(event)
      }
    }
  }

  private async processIntent(intent: BaseEvent) {
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
        chainId,
      })

      return await responsePromise
    }
  }
}
