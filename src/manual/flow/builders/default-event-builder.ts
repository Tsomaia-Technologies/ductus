import { BUILD } from '../../interfaces/flow/builders/__internal__.js'
import { EventBuilder } from '../../interfaces/flow/builders/event-builder.js'
import { EventEntity } from '../../interfaces/flow/entities/event-entity.js'

export class DefaultEventBuilder<TPayload> implements EventBuilder<TPayload> {
    private _name?: string
    private _payload?: TPayload
    private _volatility: 'durable' | 'volatile' = 'volatile'

    name(name: string): this {
        this._name = name
        return this
    }

    payload(payload: TPayload): this {
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

    [BUILD](): EventEntity<TPayload> {
        if (!this._name) throw new Error('Event requires a name.')
        if (this._payload === undefined) throw new Error('Event requires a payload.')

        return {
            name: this._name,
            payload: this._payload,
            volatility: this._volatility,
        }
    }
}
