import type { CommittedEvent } from './event.js'

export type InputEventStream = AsyncIterable<CommittedEvent>;
