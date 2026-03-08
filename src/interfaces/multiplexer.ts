import { EventSubscriber } from './event-subscriber.js'
import { BaseEvent, CommittedEvent } from './event.js'

export interface BroadcastingContext {
  sourceSubscriber?: EventSubscriber
  causationId?: string
  correlationId?: string
  chainId?: string
}

export interface Multiplexer {
  /**
   * Creates subscriber to the commited events and returns it
   *
   * @param params.name Optional name to identify subscriber (e.g. during debugging)
   */
  subscribe(params?: { name?: string | null }): EventSubscriber

  /**
   * Broadcasts event drafts as commited events to all subscribers
   *
   * @param {TEvent} event
   * @param {{ causationId?: string, correlationId?: string, chainId?: string }} [context]
   */
  broadcast(
    event: BaseEvent,
    context?: BroadcastingContext,
  ): Promise<CommittedEvent>

  waitForConsumers(excludeSubscriber?: EventSubscriber): Promise<void>
}
