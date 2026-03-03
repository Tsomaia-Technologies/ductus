import { BaseEvent, CommittedEvent } from './event.js'

export interface EventLedger<TEvent extends BaseEvent> {
  readEvents(): AsyncIterable<CommittedEvent<TEvent>>
  appendEvent(event: CommittedEvent<TEvent>): Promise<void>
}
