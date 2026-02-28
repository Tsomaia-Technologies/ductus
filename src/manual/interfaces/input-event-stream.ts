import type { CommittedEvent } from './event.js'
import { TerminateProcessorEvent } from '../events/types.js'

export type InputEventStream = AsyncIterable<TerminateProcessorEvent | CommittedEvent>;
