export type Volatility = 'durable' | 'volatile'

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T
  payload: P
  volatility: Volatility
  authorId?: string
  isCommited?: boolean
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
}
