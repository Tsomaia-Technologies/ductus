import { BaseEvent, CommittedEvent } from './event.js'
import { EventSubscriber } from './event-subscriber.js'

export interface EventSequencer {
  commit(event: BaseEvent, context?: CommitContext): Promise<CommittedEvent>

  onCommit(callback: (event: CommitEventData) => void): () => void
}

export interface CommitContext {
  causationId?: string,
  correlationId?: string,
  chainId?: string
  sourceSubscriber?: EventSubscriber
}

export interface CommitEventData {
  event: CommittedEvent
  sourceSubscriber?: EventSubscriber
}
