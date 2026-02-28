export interface EventSubscriber<TCommitedEvent extends { isReplay?: boolean }> {
  /**
   * Returns asynchronous stream of events
   */
  streamEvents(): AsyncIterable<TCommitedEvent>
}
