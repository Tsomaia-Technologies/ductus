/**
 * TelemetryProcessor Definition of Done.
 * Task 019-telemetry-processor.
 */

import { TelemetryProcessor } from "../../research/processors/telemetry-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { BaseEvent } from "../../research/interfaces/event.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockEvent(
  type: string,
  payload: unknown = {},
  isReplay?: boolean
): any {
  return {
    eventId: VALID_UUID,
    type,
    payload,
    timestamp: Date.now(),
    volatility: "durable",
    isReplay,
  } as any;
}

async function flushStream(stream: AsyncIterable<BaseEvent>): Promise<BaseEvent[]> {
  const out: BaseEvent[] = [];
  for await (const o of stream) {
    out.push(o);
  }
  return out;
}

describe("TelemetryProcessor", () => {
  describe("The Replay Accrual Proof", () => {
    it("processes AGENT_RESPONSE with isReplay: true and accumulates tokens; yields TELEMETRY_UPDATED", async () => {
      const queue = new AsyncEventQueue();
      const processor = new TelemetryProcessor();

      queue.push(
        mockEvent(
          "AGENT_RESPONSE",
          { usage: { inputTokens: 10000, outputTokens: 500 } },
          true
        )
      );
      queue.close();

      const yielded = await flushStream(processor.process(queue));

      const metrics = processor.getAccumulatedMetrics();
      expect(metrics.totalInputTokens).toBe(10000);
      expect(metrics.totalOutputTokens).toBe(500);

      const telemetry = yielded.filter((b) => b.type === "TELEMETRY_UPDATED");
      expect(telemetry).toHaveLength(1);
      expect((telemetry[0]!.payload as { totalInputTokens: number }).totalInputTokens).toBe(10000);
    });
  });

  describe("The Volatile Filter Proof", () => {
    it("every yielded event has volatility: 'volatile-draft'", async () => {
      const queue = new AsyncEventQueue();
      const processor = new TelemetryProcessor();

      queue.push(
        mockEvent("AGENT_RESPONSE", {
          usage: { inputTokens: 100, outputTokens: 50, model: "gpt-4" },
        })
      );
      queue.push(
        mockEvent("AGENT_RESPONSE", {
          usage: { inputTokens: 200, outputTokens: 100 },
        })
      );
      queue.push(mockEvent("CIRCUIT_INTERRUPTED", { signal: "SIGINT" }));
      queue.close();

      const yielded = await flushStream(processor.process(queue));

      expect(yielded.length).toBeGreaterThan(0);
      for (const b of yielded) {
        expect(b.volatility).toBe("volatile-draft");
      }
    });
  });
});
