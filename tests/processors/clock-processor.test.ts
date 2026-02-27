/**
 * ClockProcessor Definition of Done.
 * Task 007-clock-processor.
 */

import { ClockProcessor } from "../../src/processors/clock-processor.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import { MultiplexerHub } from "../../src/core/multiplexer-hub.js";
import type { InputEventStream } from "../../src/interfaces/input-event-stream.js";

const JAN_1_2024_MS = 1704067200000;

function mockEvent(
  type: string,
  timestamp: number,
  isReplay?: boolean
): {
  eventId: string;
  type: string;
  payload: Record<string, unknown>;
  authorId: string;
  timestamp: number;
  sequenceNumber: number;
  prevHash: string;
  hash: string;
  volatility: "durable" | "volatile";
  isReplay?: boolean;
} {
  return {
    eventId: "550e8400-e29b-41d4-a716-446655440000",
    type,
    payload: {},
    authorId: "bootstrap",
    timestamp,
    sequenceNumber: 1,
    prevHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    volatility: "durable",
    isReplay,
  };
}

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink consumes until done */
  }
}

describe("ClockProcessor", () => {
  describe("The Teardown Proof", () => {
    it("SYSTEM_HALT clears interval; zero active timers remain", async () => {
      jest.useFakeTimers();

      const hub = new MultiplexerHub();
      hub.mode = "LiveMode";

      const queue = new AsyncEventQueue();
      const clock = new ClockProcessor(hub, queue);

      const tickEvents: unknown[] = [];
      const originalBroadcast = hub.broadcast.bind(hub);
      hub.broadcast = async (e: Parameters<typeof hub.broadcast>[0]) => {
        if (e.type === "SYSTEM_TICK") tickEvents.push(e);
        return originalBroadcast(e);
      };

      const consumerPromise = flushStream(
        clock.process(queue as unknown as InputEventStream)
      );

      queue.push(mockEvent("SYSTEM_START", Date.now()));
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(1100);
      expect(tickEvents.length).toBeGreaterThan(0);

      queue.push(mockEvent("SYSTEM_HALT", Date.now()));
      queue.close();

      await consumerPromise;

      jest.advanceTimersByTime(0);
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });
  });

  describe("The Time Travel Proof", () => {
    it("Replay Mode: TICK timestamps match replayed event timestamps (Jan 1)", async () => {
      const broadcasts: Array<{ type: string; payload: unknown; timestamp: number }> =
        [];
      const mockHub = {
        mode: "SilentMode" as const,
        broadcast: async (e: { type: string; payload: unknown; timestamp: number }) => {
          broadcasts.push({
            type: e.type,
            payload: e.payload,
            timestamp: e.timestamp,
          });
        },
      };

      const queue = new AsyncEventQueue();
      const clock = new ClockProcessor(mockHub, queue);

      queue.push(
        mockEvent("EVENT_A", JAN_1_2024_MS, true)
      );
      queue.push(
        mockEvent("EVENT_B", JAN_1_2024_MS + 5000, true)
      );
      queue.close();

      await flushStream(clock.process(queue as unknown as InputEventStream));

      const ticks = broadcasts.filter((b) => b.type === "SYSTEM_TICK");
      expect(ticks).toHaveLength(2);
      expect(ticks[0]!.payload).toEqual({ timestamp: JAN_1_2024_MS });
      expect(ticks[1]!.payload).toEqual({
        timestamp: JAN_1_2024_MS + 5000,
      });
      expect(ticks[0]!.timestamp).toBe(JAN_1_2024_MS);
      expect(ticks[1]!.timestamp).toBe(JAN_1_2024_MS + 5000);
    });
  });
});
