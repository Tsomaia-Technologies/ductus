import { BUILD } from '../../interfaces/flow/builders/__internal__.js'
import { EventBuilder } from '../../interfaces/flow/builders/event-builder.js'
import { EventEntity } from '../../interfaces/flow/entities/event-entity.js'

export class DefaultEventBuilder<T extends string, P> implements EventBuilder<T, P> {
    private _type?: T
    private _payload?: P
    private _volatility: 'durable' | 'volatile' = 'volatile'

    type(name: T): this {
        this._type = name
        return this
    }

    payload(payload: P): this {
        this._payload = payload
        return this
    }

    volatile(): this {
        this._volatility = 'volatile'
        return this
    }

    durable(): this {
        this._volatility = 'durable'
        return this
    }

    [BUILD](): EventEntity<T, P> {
        if (!this._type) throw new Error('Event requires a type.')
        if (this._payload === undefined) throw new Error('Event requires a payload.')

        return {
            type: this._type,
            payload: this._payload,
            volatility: this._volatility,
        }
    }
}
