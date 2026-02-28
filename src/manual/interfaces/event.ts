export type Volatility = 'durable' | 'volatile'

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T
  payload: P
  authorId: string
  timestamp: number
  volatility: Volatility
  isDraft: boolean
  isReplay?: boolean
  eventId?: string
}

export interface CommittedEvent<T extends string = string, P = unknown>
  extends Omit<BaseEvent<T, P>, 'volatility'> {
  eventId: string
  sequenceNumber: number
  prevHash: string
  hash: string
  volatility: Volatility
  isDraft: false
}
