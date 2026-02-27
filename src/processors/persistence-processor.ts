/**
 * PersistenceProcessor - The Ledger (Long-Term Memory).
 * Event Sink: listens to Hub, flushes durable events to JSONL. Yields no outgoing events.
 * RFC-001 Task 004-persistence-processor, Impl Guide Phase 1.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import type { FileAdapter } from "../interfaces/adapters.js";

type EnqueuedEvent = BaseEvent;

export class PersistenceProcessor implements EventProcessor {
  constructor(
    private readonly fileAdapter: FileAdapter,
    private readonly ledgerPath: string
  ) { }

  async *process(stream: InputEventStream): OutputEventStream {
    for await (const event of stream) {
      if (event.isReplay) continue;
      if (event.volatility !== "durable") continue;
      await this.fileAdapter.append(
        this.ledgerPath,
        JSON.stringify(event) + "\n"
      );
    }
  }
}
