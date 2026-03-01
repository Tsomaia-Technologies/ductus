export interface EventProcessor<TState, TEventDraft, TCommitedEvent extends { isReplay?: boolean }> {
  process(
    events: AsyncIterable<TCommitedEvent>,
    getState: () => TState,
  ): AsyncIterable<TEventDraft>;
}
