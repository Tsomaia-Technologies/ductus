/**
 * TelemetryProcessor Definition of Done.
 * Task 019-telemetry-processor.
 */

import { TelemetryProcessor } from "../../src/processors/telemetry-processor.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import type { InputEventStream } from "../../src/interfaces/input-event-stream.js";
import type { CommitedEvent } from "../../src/core/event-contracts.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockEvent(
  type: string,
  payload: unknown = {},
  isReplay?: boolean
): CommitedEvent & { isReplay?: boolean } {
  return {
    eventId: VALID_UUID,
    type,
    payload,
    authorId: "agent-processor",
    timestamp: Date.now(),
    sequenceNumber: 1,
    prevHash: VALID_SHA256,
    hash: VALID_SHA256,
    volatility: "durable",
    isReplay,
  };
}

async function flushStream(stream: AsyncIterable<unknown>): Promise<void> {
  for await (const _ of stream) {
    /* sink */
  }
}

describe("TelemetryProcessor", () => {
  describe("The Replay Accrual Proof", () => {
    it("processes AGENT_REPORT_RECEIVED with isReplay: true and accumulates tokens; yields TELEMETRY_UPDATED", async () => {
      const broadcasts: Array<{ type: string; volatility: string; payload: unknown }> = [];
      const mockHub = {
        broadcast: async (e: { type: string; volatility: string; payload: unknown }) => {
          broadcasts.push({
            type: e.type,
            volatility: e.volatility,
            payload: e.payload,
          });
        },
      };

      const queue = new AsyncEventQueue();
      const processor = new TelemetryProcessor(mockHub, queue);

      queue.push(
        mockEvent(
          "AGENT_REPORT_RECEIVED",
          { usage: { inputTokens: 10000, outputTokens: 500 } },
          true
        )
      );
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      const metrics = processor.getAccumulatedMetrics();
      expect(metrics.totalInputTokens).toBe(10000);
      expect(metrics.totalOutputTokens).toBe(500);

      const telemetry = broadcasts.filter((b) => b.type === "TELEMETRY_UPDATED");
      expect(telemetry).toHaveLength(1);
      expect((telemetry[0]!.payload as { totalInputTokens: number }).totalInputTokens).toBe(10000);
    });
  });

  describe("The Volatile Filter Proof", () => {
    it("every yielded event has volatility: 'volatile-draft'", async () => {
      const broadcasts: Array<{ type: string; volatility: string }> = [];
      const mockHub = {
        broadcast: async (e: { type: string; volatility: string }) => {
          broadcasts.push({ type: e.type, volatility: e.volatility });
        },
      };

      const queue = new AsyncEventQueue();
      const processor = new TelemetryProcessor(mockHub, queue);

      queue.push(
        mockEvent("AGENT_REPORT_RECEIVED", {
          usage: { inputTokens: 100, outputTokens: 50, model: "gpt-4" },
        })
      );
      queue.push(
        mockEvent("AGENT_REPORT_RECEIVED", {
          usage: { inputTokens: 200, outputTokens: 100 },
        })
      );
      queue.push(mockEvent("CIRCUIT_INTERRUPTED", { signal: "SIGINT" }));
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      expect(broadcasts.length).toBeGreaterThan(0);
      for (const b of broadcasts) {
        expect(b.volatility).toBe("volatile-draft");
      }
    });
  });
});
