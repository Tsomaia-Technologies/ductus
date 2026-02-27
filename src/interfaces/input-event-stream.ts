import { CommitedEvent, ProcessorEvent } from './event.js'

export type InputEventStream = AsyncIterable<CommitedEvent<ProcessorEvent>>
