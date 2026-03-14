import { createEventFactory } from './internals.js'
import { EventPayloadShape, PayloadShape } from '../interfaces/event.js'

export function event<TType extends string, TPayloadShape extends EventPayloadShape>(
  type: TType,
  payloadShape: PayloadShape<TPayloadShape>,
) {
  return createEventFactory({ type, payloadShape, volatility: 'durable' })
}

export function signal<TType extends string, TPayloadShape extends EventPayloadShape>(
  type: TType,
  payloadShape: PayloadShape<TPayloadShape>,
) {
  return createEventFactory({ type, payloadShape, volatility: 'volatile' })
}


export function intent<TType extends string, TPayloadShape extends EventPayloadShape>(
  type: TType,
  payloadShape: PayloadShape<TPayloadShape>,
) {
  return createEventFactory({ type, payloadShape, volatility: 'intent' })
}
