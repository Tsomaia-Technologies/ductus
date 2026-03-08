import { BaseEvent, CommittedEvent } from './event.js'

export interface EventSequencer {
  commit(event: BaseEvent, context?: CommitContext): Promise<CommittedEvent>

  onCommit(callback: (event: CommittedEvent) => void): () => void
}

export interface CommitContext {
  causationId?: string,
  correlationId?: string,
  chainId?: string
}
