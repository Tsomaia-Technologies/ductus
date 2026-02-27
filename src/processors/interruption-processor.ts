/**
 * InterruptionProcessor - The Brainstem.
 * Emergency kill switch. Listens for SIGINT/SIGTERM, yields CIRCUIT_INTERRUPTED.
 * RFC-001 Task 009-interruption-processor, Rev 06 Section 6.2.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";

const AUTHOR_ID = "interruption-processor";
const GRACE_PERIOD_MS = 1000;

export class InterruptionProcessor implements EventProcessor {
  private stopCount = 0;
  private graceTimeout: ReturnType<typeof setTimeout> | null = null;
  private resolveSignal: ((signal: string) => void) | null = null;
  private nextSignalPromise!: Promise<string>;

  public readonly boundSigint = () => this.handleSignal("SIGINT");
  public readonly boundSigterm = () => this.handleSignal("SIGTERM");

  constructor() {
    process.on("SIGINT", this.boundSigint);
    process.on("SIGTERM", this.boundSigterm);
    this.resetSignal();
  }

  private resetSignal() {
    this.nextSignalPromise = new Promise<string>((r) => { this.resolveSignal = r; });
  }

  async *process(stream: InputEventStream): OutputEventStream {
    const iterator = stream[Symbol.asyncIterator]();
    let nextStreamEvent = iterator.next();

    try {
      while (true) {
        const promises: Promise<any>[] = [
          nextStreamEvent,
          this.nextSignalPromise.then(s => ({ os_signal: s }))
        ];

        const winner = await Promise.race(promises);

        if (winner && typeof winner === "object" && "os_signal" in winner) {
          const signal = winner.os_signal as string;
          this.resetSignal();

          yield {
            type: "CIRCUIT_INTERRUPTED",
            payload: { signal },
            authorId: AUTHOR_ID,
            timestamp: Date.now(),
            volatility: "durable-draft",
          } as unknown as BaseEvent;
        } else {
          const result = winner as IteratorResult<BaseEvent>;
          if (result.done) break;
          // Consume the stream as before
          nextStreamEvent = iterator.next();
        }
      }
    } finally {
      this.detach();
    }
  }

  /** Invokable for tests. Signal string, e.g. 'SIGINT' or 'SIGTERM'. */
  handleSignal(signal: string): void {
    this.stopCount += 1;
    if (this.stopCount === 1) {
      if (this.resolveSignal) {
        this.resolveSignal(signal);
      }
      this.graceTimeout = setTimeout(() => {
        this.graceTimeout = null;
        process.exit(1);
      }, GRACE_PERIOD_MS);
    } else {
      if (this.graceTimeout !== null) {
        clearTimeout(this.graceTimeout);
        this.graceTimeout = null;
      }
      process.exit(1);
    }
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
