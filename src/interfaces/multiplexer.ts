import { EventSubscriber } from './event-subscriber.js'
import { BaseEvent, CommittedEvent } from './event.js'

export interface Multiplexer<TEvent extends BaseEvent> {
  /**
   * Creates subscriber to the commited events and returns it
   */
  subscribe(): EventSubscriber<CommittedEvent<TEvent>>

  /**
   * Registers synchronous listener that is invoked when event is commited and is about to be broadcasted,
   * but right before broadcasting it.
   *
   * @param callback
   */
  onCommit(callback: (event: CommittedEvent<TEvent>) => void): () => void

  /**
   * Broadcasts event drafts as commited events to all subscribers
   *
   * @param {TEvent} event
   * @param {{ causationId?: string, correlationId?: string }} [context]
   */
  broadcast(event: TEvent, context?: { causationId?: string, correlationId?: string }): Promise<void>
}
