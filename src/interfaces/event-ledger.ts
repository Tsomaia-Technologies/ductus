import { BaseEvent, CommittedEvent } from './event.js'

export interface EventLedger<TEvent extends BaseEvent> {
  readEvents(options?: { afterSequence?: number }): AsyncIterable<CommittedEvent<TEvent>>

  readLastEvent(): Promise<CommittedEvent<TEvent> | null>

  appendEvent(event: CommittedEvent<TEvent>): Promise<void>
}
