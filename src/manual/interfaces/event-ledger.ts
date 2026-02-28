export interface EventLedger<TCommitedEvent> {
  readEvents(): AsyncIterable<TCommitedEvent>
}
