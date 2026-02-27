import { InputEventStream } from "./input-event-stream.js";
import { OutputEventStream } from "./output-event-stream.js";
import type { EventQueue } from "./event-queue.js";

export interface EventProcessor {
  readonly incomingQueue: EventQueue;
  process(stream: InputEventStream): OutputEventStream;
}
