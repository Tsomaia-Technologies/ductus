import { EventSubscriber } from './event-subscriber.js'

export interface Multiplexer<TEventDraft, TCommitedEvent> {
  /**
   * Creates subscriber to the commited events and returns it
   */
  subscribe(): EventSubscriber<TCommitedEvent>

  /**
   * Registers synchronous listener that is invoked when event is commited and is about to be broadcasted,
   * but right before broadcasting it.
   *
   * @param callback
   */
  onCommit(callback: (event: TCommitedEvent) => void): () => void

  /**
   * Broadcasts event drafts as commited events to all subscribers
   *
   * @param {TEventDraft} event
   */
  broadcast(event: TEventDraft): Promise<void>
}
