import { DuctusEvent } from '../events/types.js'

export type Volatility = 'durable' | 'volatile'

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T
  payload: P
  authorId: string
  timestamp: number
  volatility: Volatility
  isCommited?: boolean
}

export type CommittedEvent<TEvent extends DuctusEvent = DuctusEvent> = TEvent & {
  eventId: string
  sequenceNumber: number
  prevHash: string
  isCommited: true
  hash: string
}
