import type { CommittedEvent } from './event.js'

export type InputEventStream<TEvent> = AsyncIterable<CommittedEvent<TEvent>>;
