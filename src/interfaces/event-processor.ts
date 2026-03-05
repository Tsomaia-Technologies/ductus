import { BaseEvent, CommittedEvent } from './event.js'
import { Injector } from './event-generator.js'

export interface EventProcessor<TState> {
  process(
    events: AsyncIterable<CommittedEvent>,
    getState: () => TState,
    injector: Injector,
  ): AsyncIterable<BaseEvent>;
}
