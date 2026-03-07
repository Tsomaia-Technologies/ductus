import { EventPayloadShape, PayloadShape } from 'ductus'
import { createEventFactory } from './internals.js'

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
