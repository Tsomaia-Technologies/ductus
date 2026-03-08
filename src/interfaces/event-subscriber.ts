import { CommittedEvent } from './event.js'
import { Disposer } from './cancellation-token.js'

export interface EventSubscriber {
  /**
   * Returns the name of the subscriber
   */
  name(): string | null

  enqueue(event: CommittedEvent): void

  isConsuming(): boolean

  consume<T>(callback: () => Promise<T>): Promise<T>

  waitForDrain(): Promise<void>

  onDrain(callback: () => void): Disposer

  /**
   * Returns asynchronous stream of events
   */
  streamEvents(): AsyncIterable<CommittedEvent>

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
