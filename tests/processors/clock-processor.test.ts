/**
 * ClockProcessor Definition of Done.
 * Task 007-clock-processor.
 */

import { ClockProcessor } from "../../research/processors/clock-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { InputEventStream } from "../../research/interfaces/event-processor.js";
import type { BaseEvent } from "../../research/interfaces/event.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const JAN_1_2024_MS = 1704067200000;

function mockEvent(
  type: string,
  timestamp: number,
  isReplay?: boolean
): any {
  return {
    eventId: VALID_UUID,
    type,
    payload: {},
    authorId: "bootstrap",
    timestamp,
    volatility: "durable" as const,
    isReplay,
  };
}

describe("ClockProcessor", () => {
  describe("The Teardown Proof", () => {
    it("SYSTEM_HALT clears interval; zero active timers remain", async () => {
      jest.useFakeTimers();

      const queue = new AsyncEventQueue();
      const clock = new ClockProcessor();
      const outStream = clock.process(queue as any);

      const yielded: BaseEvent[] = [];
      const consumeTask = (async () => {
        for await (const e of outStream) {
          yielded.push(e);
          if (e.type === "TICK" && yielded.length >= 2) {
            queue.push(mockEvent("SYSTEM_HALT", Date.now()));
            queue.close();
          }
        }
      })();

      queue.push(mockEvent("SYSTEM_START", Date.now()));

      await jest.advanceTimersByTimeAsync(3000);
      await consumeTask;

      expect(yielded.filter(e => e.type === "TICK").length).toBeGreaterThan(0);
      expect(jest.getTimerCount()).toBe(0);

      jest.useRealTimers();
    });
  });

  describe("The Time Travel Proof", () => {
    it("Replay Mode: TICK timestamps match replayed event timestamps", async () => {
      const queue = new AsyncEventQueue();
      const clock = new ClockProcessor();
      const outStream = clock.process(queue as any);

      queue.push(mockEvent("EVENT_A", JAN_1_2024_MS, true));
      queue.push(mockEvent("EVENT_B", JAN_1_2024_MS + 5000, true));
      queue.close();

      const yielded: BaseEvent[] = [];
      for await (const e of outStream) {
        yielded.push(e);
      }

      const ticks = yielded.filter((b) => b.type === "TICK");
      expect(ticks).toHaveLength(2);
      expect((ticks[0]!.payload as any).isReplay).toBe(true);
      expect(ticks[0]!.timestamp).toBe(JAN_1_2024_MS);
      expect(ticks[1]!.timestamp).toBe(JAN_1_2024_MS + 5000);
    });
  });
});
