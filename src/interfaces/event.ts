import * as zod from 'zod/v3'

export type Volatility = 'durable' | 'volatile'

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T
  payload: P
  volatility: Volatility
  isCommited?: boolean
}

export type EventPayloadShape = zod.ZodRawShape
export type PayloadShape<T extends EventPayloadShape> = zod.ZodObject<T, 'strict'> | T

export type EventDefinition<TType extends string = string, TPayloadShape extends EventPayloadShape = any> = {
  (payload: PayloadShape<TPayloadShape>): BaseEvent<TType, typeof payload>

  readonly is: (event: BaseEvent) => event is BaseEvent<TType, zod.input<zod.ZodObject<TPayloadShape, 'strict'>>>

  readonly type: TType
  readonly volatility: Volatility
  readonly payloadSchema: TPayloadShape
}

export type CommittedEvent<T extends BaseEvent = BaseEvent> = T & {
  eventId: string
  causationId?: string
  correlationId?: string
  sequenceNumber: number
  prevHash: string
  isCommited: true
  hash: string
  timestamp: number
  authorId: string
}
