export interface EventProcessor<TState, TEventDraft, TCommitedEvent> {
  process(
    events: AsyncIterable<TCommitedEvent>,
    getState: () => TState,
  ): AsyncIterable<TEventDraft>;
}
