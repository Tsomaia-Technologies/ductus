/**
 * InterruptionProcessor - The Brainstem.
 * Emergency kill switch. Listens for SIGINT/SIGTERM, yields CIRCUIT_INTERRUPTED.
 * RFC-001 Task 009-interruption-processor, Rev 06 Section 6.2.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import { RingBufferQueue } from "../core/event-queue.js";

const AUTHOR_ID = "interruption-processor";
const GRACE_PERIOD_MS = 1000;

export class InterruptionProcessor implements EventProcessor {
  private stopCount = 0;
  private graceTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly outQueue = new RingBufferQueue<BaseEvent>(16);

  private readonly boundSigint = () => this.handleSignal("SIGINT");
  private readonly boundSigterm = () => this.handleSignal("SIGTERM");

  constructor() {
    process.on("SIGINT", this.boundSigint);
    process.on("SIGTERM", this.boundSigterm);
  }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consume(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consume(stream: InputEventStream): Promise<void> {
    for await (const event of stream) { }
    this.outQueue.close();
  }

  /** Invokable for tests. Signal string, e.g. 'SIGINT' or 'SIGTERM'. */
  handleSignal(signal: string): void {
    this.stopCount += 1;

    if (this.stopCount === 1) {
      this.outQueue.push({
        type: "CIRCUIT_INTERRUPTED",
        payload: { signal },
        authorId: AUTHOR_ID,
        timestamp: Date.now(),
        volatility: "durable-draft",
      } as unknown as BaseEvent);

      this.graceTimeout = setTimeout(() => {
        this.graceTimeout = null;
        process.exit(1);
      }, GRACE_PERIOD_MS);
      return;
    }

    if (this.graceTimeout !== null) {
      clearTimeout(this.graceTimeout);
      this.graceTimeout = null;
    }
    process.exit(1);
  }

  detach(): void {
    process.removeListener("SIGINT", this.boundSigint);
    process.removeListener("SIGTERM", this.boundSigterm);
    if (this.graceTimeout !== null) {
      clearTimeout(this.graceTimeout);
      this.graceTimeout = null;
    }
  }
}
