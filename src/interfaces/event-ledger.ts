import { CommittedEvent } from './event.js'

export interface EventLedger {
  readEvents(options?: { afterSequence?: number }): AsyncIterable<CommittedEvent>

  readLastEvent(): Promise<CommittedEvent | null>

  appendEvent(event: CommittedEvent): Promise<void>

  dispose(): Promise<void>
}
