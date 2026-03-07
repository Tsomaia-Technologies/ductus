import { EventSubscriber } from './event-subscriber.js'
import { BaseEvent, CommittedEvent } from './event.js'
import { Token } from './event-generator.js'

export const Multiplexer = Token<Multiplexer>()

export interface Multiplexer {
  /**
   * Creates subscriber to the commited events and returns it
   */
  subscribe(): EventSubscriber

  /**
   * Registers synchronous listener that is invoked when event is commited and is about to be broadcasted,
   * but right before broadcasting it.
   *
   * @param callback
   */
  onCommit(callback: (event: CommittedEvent) => void): () => void

  /**
   * Broadcasts event drafts as commited events to all subscribers
   *
   * @param {TEvent} event
   * @param {{ causationId?: string, correlationId?: string, chainId?: string }} [context]
   */
  broadcast(
    event: BaseEvent,
    context?: { causationId?: string, correlationId?: string, chainId?: string },
  ): Promise<void>
}
