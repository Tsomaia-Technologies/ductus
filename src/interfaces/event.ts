export interface BaseEvent<T extends string, P> {
  type: T
  payload: P
  authorId: string
  timestamp: number
  volatility: 'durable-draft' | 'volatile-draft'
}

export type CommitedEvent<TEvent extends BaseEvent<any, unknown>> = Omit<TEvent, 'volatility'> & {
  eventId: string
  sequenceNumber: number
  prevHash: string
  hash: string
  volatility: 'durable' | 'volatile'
}

export type EventA = BaseEvent<'A', {}>
export type EventB = BaseEvent<'B', {}>
export type ProcessorEvent = EventA | EventB
