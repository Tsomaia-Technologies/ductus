import { BUILD } from '../interfaces/builders/__internal__.js'
import { EventBuilder } from '../interfaces/builders/event-builder.js'
import { EventEntity } from '../interfaces/entities/event-entity.js'

interface EventBuilderParams<T extends string, P> {
  type?: T
  payload?: P
  volatility: 'durable' | 'volatile'
}

export class ImmutableEventBuilder<T extends string, P> implements EventBuilder<T, P> {
  private params: EventBuilderParams<T, P>

  constructor() {
    this.params = {
      volatility: 'volatile',
    }
  }

  type(name: T): this {
    return this.clone({ type: name })
  }

  payload(payload: P): this {
    return this.clone({ payload })
  }

  volatile(): this {
    return this.clone({ volatility: 'volatile' })
  }

  durable(): this {
    return this.clone({ volatility: 'durable' })
  }

  [BUILD](): EventEntity<T, P> {
    if (!this.params.type) throw new Error('Event requires a type.')
    if (this.params.payload === undefined) throw new Error('Event requires a payload.')

    return {
      type: this.params.type,
      payload: this.params.payload,
      volatility: this.params.volatility,
    }
  }

  private clone(params: Partial<EventBuilderParams<T, P>>): this {
    const Constructor = this.constructor as new () => this
    const clone = new Constructor()
    clone.params = { ...this.params, ...params }
    return clone
  }
}
