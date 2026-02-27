import { InputEventStream } from './input-event-stream.js'
import { OutputEventStream } from './output-event-stream.js'

export interface EventProcessor {
  process(stream: InputEventStream): OutputEventStream
}
