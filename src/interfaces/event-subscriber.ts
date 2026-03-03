import { BaseEvent, CommittedEvent } from './event.js'

export interface EventSubscriber<TEvent extends BaseEvent> {
  /**
   * Returns asynchronous stream of events
   */
  streamEvents(): AsyncIterable<CommittedEvent<TEvent>>

  /**
   * Unsubscribes the subscriber from the source
   *
   * If params.drain is true - let's the subscriber emit the already queued events, before unsubscribing.
   *
   * If params.drain is false - discards all accumulated events and unsubscribes immediately.
   */
  unsubscribe(params?: { drain?: boolean }): void

  /**
   * Registers a callback that gets invoked when the subscriber unsubscribes
   *
   * @param callback
   */
  onUnsubscribe(callback: () => void): void
}
