import * as zod from 'zod/v3'

export type Volatility = 'durable' | 'volatile'

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T
  payload: P
  volatility: Volatility
  isCommited?: boolean
}

export type EventFactory<TType extends string, TPayloadShape extends zod.ZodRawShape> = {
  (
    payload: zod.input<zod.ZodObject<TPayloadShape, 'strict'>>
  ): BaseEvent<TType, typeof payload>

  readonly type: TType
  readonly volatility: Volatility
  readonly payloadSchema: TPayloadShape
}

export type CommittedEvent<TEvent extends BaseEvent> = TEvent & {
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
