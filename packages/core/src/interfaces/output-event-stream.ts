import { BaseEvent } from './event.js'

export type OutputEventStream = AsyncIterable<BaseEvent | undefined>;
