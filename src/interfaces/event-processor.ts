import { CommittedEvent } from './event.js'
import { OutputEventStream } from './output-event-stream.js'
import { Injector } from './event-generator.js'

export interface EventProcessor<TState> {
  process(
    events: AsyncIterable<CommittedEvent>,
    getState: () => TState,
    injector: Injector,
  ): OutputEventStream;
}
