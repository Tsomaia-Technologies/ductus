import { CommittedEvent } from './event.js'

export interface EventLedger<TEvent> {
  readEvents(): AsyncIterable<CommittedEvent<TEvent>>
}
