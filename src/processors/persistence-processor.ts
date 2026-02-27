/**
 * PersistenceProcessor - The Ledger (Long-Term Memory).
 * Event Sink: listens to Hub, flushes durable events to JSONL. Yields no outgoing events.
 * RFC-001 Task 004-persistence-processor, Impl Guide Phase 1.
 */

import type { CommitedEvent } from "../core/event-contracts.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { FileAdapter } from "../interfaces/adapters.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";

type EnqueuedEvent = CommitedEvent & { isReplay?: boolean };

export class PersistenceProcessor implements EventProcessor {
  constructor(
    private readonly fileAdapter: FileAdapter,
    private readonly ledgerPath: string,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndSink(stream);
  }

  private async *consumeAndSink(
    stream: AsyncIterable<EnqueuedEvent>
  ): OutputEventStream {
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
