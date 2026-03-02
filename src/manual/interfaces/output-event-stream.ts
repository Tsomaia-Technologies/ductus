import { BaseEvent } from './event.js'

export type OutputEventStream<TEvent extends BaseEvent> = AsyncIterable<TEvent>;
