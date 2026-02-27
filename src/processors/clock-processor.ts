/**
 * ClockProcessor - The Suprachiasmatic Nucleus.
 * Single source of logical time. Injects TICK events into the Hub.
 * RFC-001 Task 007-clock-processor, Impl Guide Phase 2.
 */

import type { BaseEvent } from "../core/event-contracts.js";
import type { EventProcessor } from "../interfaces/event-processor.js";
import type { InputEventStream } from "../interfaces/input-event-stream.js";
import type { OutputEventStream } from "../interfaces/output-event-stream.js";
import type { EventQueue } from "../interfaces/event-queue.js";
import type { HubMode } from "../core/multiplexer-hub.js";

interface ClockHub {
  mode: HubMode;
  broadcast(base: BaseEvent): Promise<void>;
}

type EnqueuedEvent = { type: string; timestamp: number; isReplay?: boolean };

const TICK_INTERVAL_MS = 1000;
const AUTHOR_ID = "clock-processor";

export class ClockProcessor implements EventProcessor {
  private intervalRef: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly hub: ClockHub,
    public readonly incomingQueue: EventQueue
  ) {}

  process(stream: InputEventStream): OutputEventStream {
    return this.consumeAndDispatch(stream);
  }

  private async *consumeAndDispatch(
    stream: AsyncIterable<EnqueuedEvent>
  ): OutputEventStream {
    for await (const event of stream) {
      if (event.type === "SYSTEM_START") {
        if (this.hub.mode === "LiveMode") {
          this.startLiveInterval();
        }
      } else if (
        event.type === "SYSTEM_HALT" ||
        event.type === "CIRCUIT_INTERRUPTED"
      ) {
        this.stopInterval();
      }

      if (
        event.isReplay === true &&
        event.type !== "SYSTEM_TICK"
      ) {
        this.broadcastTick(event.timestamp);
      }
    }
  }

  private startLiveInterval(): void {
    this.stopInterval();
    this.intervalRef = setInterval(() => {
      this.broadcastTick(Date.now());
    }, TICK_INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.intervalRef !== null) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private broadcastTick(timestamp: number): void {
    void this.hub.broadcast({
      type: "SYSTEM_TICK",
      payload: { timestamp },
      authorId: AUTHOR_ID,
      timestamp,
      volatility: "durable-draft",
    });
  }
}
