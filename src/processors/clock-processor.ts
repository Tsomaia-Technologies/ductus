/**
 * ClockProcessor - The Suprachiasmatic Nucleus.
 * Single source of logical time. Injects TICK events into the Hub.
 * RFC-001 Task 007-clock-processor, Impl Guide Phase 2.
 */

import type { BaseEvent } from "../interfaces/event.js";
import type { EventProcessor, InputEventStream, OutputEventStream } from "../interfaces/event-processor.js";
import { RingBufferQueue } from "../core/event-queue.js";
import { createTick } from "../core/events/creators.js";

const TICK_INTERVAL_MS = 1000;
const AUTHOR_ID = "clock-processor";

export class ClockProcessor implements EventProcessor {
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private readonly outQueue = new RingBufferQueue<BaseEvent>(128);

  constructor() { }

  async *process(stream: InputEventStream): OutputEventStream {
    this.consume(stream).catch(console.error);
    for await (const out of this.outQueue) {
      yield out;
    }
  }

  private async consume(
    stream: InputEventStream
  ): Promise<void> {
    for await (const event of stream) {
      if (event.type === "SYSTEM_START") {
        // We do not have hub.mode injected anymore. Replays are tagged on the event natively.
        // Wait, if "SYSTEM_START" is replayed, its `.isReplay` flag guarantees we jump.
        if (!event.isReplay) {
          this.startLiveInterval();
        }
      } else if (
        event.type === "SYSTEM_HALT" ||
        event.type === "CIRCUIT_INTERRUPTED"
      ) {
        this.stopInterval();
      }

      const isReplay = (event as any).isReplay === true;
      if (
        isReplay &&
        event.type !== "TICK"
      ) {
        this.broadcastTick(event.timestamp, isReplay);
      }
    }

    this.outQueue.close();
  }

  private startLiveInterval(): void {
    this.stopInterval();
    this.intervalRef = setInterval(() => {
      this.broadcastTick(Date.now(), false);
    }, TICK_INTERVAL_MS);
  }

  private stopInterval(): void {
    if (this.intervalRef !== null) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  private broadcastTick(timestamp: number, isReplay: boolean): void {
    this.outQueue.push(createTick({
      payload: { ms: TICK_INTERVAL_MS, isReplay },
      authorId: AUTHOR_ID,
      timestamp
    }));
  }
}
