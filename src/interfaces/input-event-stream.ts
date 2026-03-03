import { BaseEvent, CommittedEvent } from './event.js'

export type InputEventStream<TEvent extends BaseEvent> = AsyncIterable<CommittedEvent<TEvent>>;
