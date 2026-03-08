import * as zod from 'zod/v3'

export type Volatility = 'durable' | 'volatile' | 'intent'

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T
  payload: P
  volatility: Volatility
  isCommited?: boolean
}

export type EventPayloadShape = zod.ZodRawShape
export type PayloadShape<T extends EventPayloadShape> = zod.ZodObject<T, 'strict'> | T

export interface BaseEventDefinition<TType extends string = string, TPayload = any> {
  (payload: TPayload): BaseEvent<TType, typeof payload>

  readonly is: (event: BaseEventDefinition | BaseEvent) => event is BaseEvent<TType, TPayload>
  readonly type: TType
  readonly volatility: Volatility
}

export interface BroadcastableEventDefinition<TType extends string = string, TPayloadShape
  extends EventPayloadShape = any> extends BaseEventDefinition<TType, zod.input<zod.ZodObject<TPayloadShape, 'strict'>>> {

  readonly volatility: 'durable' | 'volatile'
  readonly payloadSchema: TPayloadShape
}

export interface IntentDefinition<TType extends string = string, TPayload = any>
  extends BaseEventDefinition<TType, TPayload> {

  readonly volatility: 'intent'
  readonly payloadSchema: TPayload
}

export type EventDefinition<TType extends string = string, TPayload = any> =
  | (TPayload extends EventPayloadShape ? BroadcastableEventDefinition<TType, TPayload> : never)
  | IntentDefinition<TType>

export type CommittedEvent<T extends BaseEvent = BaseEvent> = T & {
  eventId: string
  causationId?: string
  correlationId?: string
  chainId?: string
  sequenceNumber: number
  prevHash: string
  isCommited: true
  timestamp: number
  hash: string
}
