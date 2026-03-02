import { DuctusEvent } from '../events/types.js'

export type Volatility = 'durable' | 'volatile'

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T
  payload: P
  authorId?: string
  volatility: Volatility
  isCommited?: boolean
}

export type CommittedEvent<TEvent = DuctusEvent> = TEvent & {
  eventId: string
  sequenceNumber: number
  prevHash: string
  isCommited: true
  hash: string
  timestamp: number
}
