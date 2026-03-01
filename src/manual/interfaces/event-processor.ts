import { CommittedEvent } from './event.js'

export interface EventProcessor<TState, TEventDraft> {
  process(
    events: AsyncIterable<CommittedEvent<TEventDraft>>,
    getState: () => TState,
  ): AsyncIterable<TEventDraft>;
}
