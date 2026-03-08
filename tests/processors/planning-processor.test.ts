/**
 * PlanningProcessor Definition of Done.
 * Task 017-planning-processor.
 */

import { PlanningProcessor } from "../../research/processors/planning-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { InputEventStream } from "../../research/interfaces/input-event-stream.js";
import type { EventQueue } from "../../research/interfaces/event-queue.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink */
  }
}

function mockEvent(
  type: string,
  payload: unknown,
  isReplay = false
): Parameters<EventQueue["push"]>[0] {
  return {
    eventId: VALID_UUID,
    type,
    payload,
    timestamp: 0,
    sequenceNumber: 1,
    prevHash: VALID_SHA256,
    hash: VALID_SHA256,
    volatility: "durable" as const,
    isReplay,
  };
}

describe("PlanningProcessor", () => {
  describe("The Approval Relay Test", () => {
    it("INPUT_RECEIVED with answer Yes yields PLAN_APPROVED containing the spec", async () => {
      const queue = new AsyncEventQueue();
      const broadcasts: Array<{ type: string; payload: unknown }> = [];
      let capturedRequestId = "";

      const processor = new PlanningProcessor();
      const outStream = processor.process(queue);

      const yielded: Array<{ type: string; payload: unknown }> = [];

      const consumeTask = (async () => {
        for await (const e of outStream) {
          yielded.push({ type: e.type, payload: e.payload });
          if (e.type === "REQUEST_INPUT") {
            const p = e.payload as { id?: string };
            capturedRequestId = p?.id ?? "";
            if (capturedRequestId) {
              queue.push({
                eventId: VALID_UUID,
                type: "INPUT_RECEIVED",
                payload: { id: capturedRequestId, answer: "Yes" },
                timestamp: Date.now(),
                sequenceNumber: 2,
                prevHash: VALID_SHA256,
                hash: VALID_SHA256,
                volatility: "durable" as const,
              });
              // We must wait a tick to ensure the processor has time to process the YES and yield PLAN_APPROVED
              // before we close the queue cutting off the iterator abruptly.
              setTimeout(() => {
                queue.close();
              }, 10);
            }
          }
        }
      })();

      queue.push(
        mockEvent("AGENT_RESPONSE", "# SPEC\nBuild a login API.")
      );

      await consumeTask;

      const planApproved = yielded.filter((b) => b.type === "PLAN_APPROVED");
      expect(planApproved).toHaveLength(1);
      const payload = planApproved[0]!.payload as { spec?: string };
      expect(payload.spec).toBe("# SPEC\nBuild a login API.");
    });
  });

  describe("Muted Mode Protection", () => {
    it("ignores START_PLANNING when isReplay is true", async () => {
      const queue = new AsyncEventQueue();
      const broadcasts: Array<{ type: string; payload: unknown }> = [];
      const processor = new PlanningProcessor();
      const outStream = processor.process(queue);
      const yielded: Array<{ type: string; payload: unknown }> = [];

      queue.push(
        mockEvent("START_PLANNING", { prompt: "Build X" }, true)
      );
      queue.close();

      for await (const e of outStream) {
        yielded.push(e);
      }

      const effectSpawn = yielded.filter((b) => b.type === "EFFECT_SPAWN_AGENT");
      expect(effectSpawn).toHaveLength(0);
    });
  });

  describe("The Redaction Loop", () => {
    it("INPUT_RECEIVED with rejection yields PLAN_REJECTED and EFFECT_SPAWN_AGENT", async () => {
      const queue = new AsyncEventQueue();
      const broadcasts: Array<{ type: string; payload: unknown }> = [];
      let capturedRequestId = "";

      const processor = new PlanningProcessor();
      const outStream = processor.process(queue);

      const yielded: Array<{ type: string; payload: unknown }> = [];
      const consumeTask = (async () => {
        for await (const e of outStream) {
          yielded.push({ type: e.type, payload: e.payload });
          if (e.type === "REQUEST_INPUT") {
            const p = e.payload as { id?: string };
            const reqId = p?.id ?? "";
            if (reqId) {
              queue.push({
                eventId: VALID_UUID,
                type: "INPUT_RECEIVED",
                payload: { id: reqId, answer: "No, add authentication to the spec" },
                timestamp: Date.now(),
                sequenceNumber: 2,
                prevHash: VALID_SHA256,
                hash: VALID_SHA256,
                volatility: "durable" as const,
              });
              setTimeout(() => queue.close(), 10);
            }
          }
        }
      })();

      queue.push(
        mockEvent("AGENT_RESPONSE", "# SPEC v1")
      );

      await consumeTask;

      const planRejected = yielded.filter((b) => b.type === "PLAN_REJECTED");
      expect(planRejected).toHaveLength(1);

      const spawnAgent = yielded.filter((b) => b.type === "EFFECT_SPAWN_AGENT");
      expect(spawnAgent.length).toBeGreaterThanOrEqual(1);
      const spawnPayload = spawnAgent[spawnAgent.length - 1]!.payload as {
        roleName?: string;
        input?: string;
        context?: unknown;
      };
      expect(spawnPayload.roleName).toBe("planner");
      expect(spawnPayload.input).toContain("authentication");
    });
  });
});
