import { BaseEvent, CommittedEvent } from './event.js'
import { Injector } from './event-generator.js'

export interface EventProcessor<TEvent extends BaseEvent, TState> {
  process(
    events: AsyncIterable<CommittedEvent<TEvent>>,
    getState: () => TState,
    injector: Injector,
  ): AsyncIterable<TEvent>;
}
