/**
 * PersistenceProcessor - The Ledger (Long-Term Memory).
 * Event Sink: listens to Hub, flushes durable events to JSONL. Yields no outgoing events.
 * RFC-001 Task 004-persistence-processor, Impl Guide Phase 1.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { FileAdapter } from "../interfaces/adapters.js";
import { RingBufferQueue } from "../core/event-queue.js";

type EnqueuedEvent = BaseEvent;

export class PersistenceProcessor implements EventProcessor {
  private readonly outQueue = new RingBufferQueue<BaseEvent>(16);

  constructor(
    private readonly fileAdapter: FileAdapter,
    private readonly ledgerPath: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consumeAndSink(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consumeAndSink(
    stream: AsyncIterable<EnqueuedEvent>
  ): Promise<void> {
    for await (const event of stream) {
      if (event.isReplay) continue;
      if (event.volatility !== "durable") continue;
      await this.fileAdapter.append(
        this.ledgerPath,
        JSON.stringify(event) + "\n"
      );
    }
    this.outQueue.close();
  }
}
