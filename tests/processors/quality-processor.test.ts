/**
 * QualityProcessor Definition of Done.
 * Task 018-quality-processor.
 */

import { QualityProcessor } from "../../src/processors/quality-processor.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import type { DuctusConfig } from "../../src/core/ductus-config-schema.js";
import type { InputEventStream } from "../../src/interfaces/event-processor.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink */
  }
}

async function runMockToolResponder(
  outStream: AsyncIterable<import("../../src/interfaces/event.js").BaseEvent>,
  queue: AsyncEventQueue,
  yieldedOut: import("../../src/interfaces/event.js").BaseEvent[],
  toolStdout: string,
  checkExitCode = 0
) {
  let pendingChecks = 1;

  for await (const e of outStream) {
    yieldedOut.push(e);
    const p = e.payload as { command?: string; trackingId?: string; args?: string[] };
    if (e.type === "EFFECT_RUN_TOOL" && p?.trackingId) {
      pendingChecks--;
      queue.push({
        eventId: VALID_UUID,
        type: "TOOL_COMPLETED",
        payload: {
          trackingId: p.trackingId,
          exitCode: checkExitCode,
          stdout: toolStdout,
          stderr: "",
          log: toolStdout,
        },
        authorId: "tool-processor",
        timestamp: Date.now(),
        sequenceNumber: 1,
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
        volatility: "durable" as const,
      });

      if (pendingChecks <= 0) {
        queue.close();
      }
    }

    if (e.type === "AUTO_REJECTION") {
      queue.close();
    }
  }
}

describe("QualityProcessor", () => {
  describe("The Feature Escalation Proof", () => {
    it("yields EFFECT_RUN_TOOL for per_feature check (npm run e2e), ignores per_task", async () => {
      const queue = new AsyncEventQueue();

      const config: DuctusConfig = {
        default: {
          checks: {
            unit: {
              command: "npm run test",
              boundary: "per_task",
            },
            e2e: {
              command: "npm run e2e",
              boundary: "per_feature",
            },
          },
          roles: {
            planner: {
              lifecycle: "single-shot",
              maxRejections: 3,
              maxRecognizedHallucinations: 0,
              strategies: [{ id: "p", model: "claude", template: "p" }],
            },
            engineer: {
              lifecycle: "session",
              maxRejections: 5,
              maxRecognizedHallucinations: 2,
              strategies: [{ id: "e", model: "claude", template: "e" }],
            },
          },
        },
        scopes: {},
      };

      const processor = new QualityProcessor(config, "/tmp");
      const outStream = processor.process(queue as any);
      const yielded: any[] = [];
      const consumeTask = runMockToolResponder(outStream, queue, yielded, "No errors found\n", 0);

      queue.push({
        eventId: VALID_UUID,
        type: "FEATURE_IMPLEMENTED",
        payload: { files: ["x.ts"] },
        authorId: "development-processor",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
        volatility: "durable" as const,
      });
      queue.close();

      await consumeTask;

      const effectRunTools = yielded.filter((b) => b.type === "EFFECT_RUN_TOOL");
      expect(effectRunTools).toHaveLength(1);
      const payload = effectRunTools[0]!.payload as { command: string; args?: string[] };
      const fullCommand =
        payload.command + (payload.args?.length ? " " + payload.args.join(" ") : "");
      expect(fullCommand).toBe("npm run e2e");
    });
  });

  describe("The Auditor Spawn Proof", () => {
    it("yields EFFECT_SPAWN_AGENT (auditor) after per_feature tools pass, not FEATURE_APPROVED", async () => {
      const queue = new AsyncEventQueue();
      // const broadcasts: Array<{ type: string; payload: unknown }> = []; // Removed

      // const hub = { // Removed
      //   broadcast: async (e: { type: string; payload: unknown }) => {
      //     broadcasts.push({ type: e.type, payload: e.payload });
      //     const p = e.payload as { trackingId?: string };
      //     if (e.type === "EFFECT_RUN_TOOL" && p?.trackingId) {
      //       queue.push({
      //         eventId: "mock-tool",
      //         type: "TOOL_COMPLETED",
      //         payload: {
      //           trackingId: p.trackingId,
      //           exitCode: 0,
      //           stdout: "",
      //           stderr: "",
      //           log: "",
      //         },
      //         authorId: "tool-processor",
      //         timestamp: Date.now(),
      //         sequenceNumber: 2,
      //         prevHash: VALID_SHA256,
      //         hash: VALID_SHA256,
      //         volatility: "durable" as const,
      //       });
      //     }
      //   },
      // };

      const config: DuctusConfig = {
        default: {
          checks: {
            e2e: { command: "npm run e2e", boundary: "per_feature" as const },
          },
          roles: {
            planner: {
              lifecycle: "single-shot",
              maxRejections: 3,
              maxRecognizedHallucinations: 0,
              strategies: [{ id: "p", model: "claude", template: "p" }],
            },
            engineer: {
              lifecycle: "session",
              maxRejections: 5,
              maxRecognizedHallucinations: 2,
              strategies: [{ id: "e", model: "claude", template: "e" }],
            },
            auditor: {
              lifecycle: "single-shot",
              maxRejections: 0,
              maxRecognizedHallucinations: 0,
              strategies: [{ id: "a", model: "claude", template: "auditor" }],
            },
          },
        },
        scopes: {},
      };

      const processor = new QualityProcessor(config, "/tmp");
      const outStream = processor.process(queue as any);
      const yielded: any[] = [];
      const consumeTask = runMockToolResponder(outStream, queue, yielded, "No errors found\n", 0);

      queue.push({
        eventId: VALID_SHA256,
        type: "FEATURE_IMPLEMENTED",
        payload: { files: ["x.ts"] },
        authorId: "dev",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: VALID_SHA256,
        hash: VALID_SHA256,
        volatility: "durable" as const,
      });
      queue.close();

      await consumeTask;

      const effectSpawnAgent = yielded.filter((b) => b.type === "EFFECT_SPAWN_AGENT");
      expect(effectSpawnAgent.length).toBeGreaterThanOrEqual(1);
      const spawnPayload = effectSpawnAgent[effectSpawnAgent.length - 1]!
        .payload as { roleName?: string; correlationId?: string };
      expect(spawnPayload.roleName).toBe("auditor");
      expect(spawnPayload.correlationId).toBeDefined();

      const featureApproved = yielded.filter((b) => b.type === "FEATURE_APPROVED");
      expect(featureApproved).toHaveLength(0);
    });
  });

  describe("Muted Mode Protection", () => {
    it("ignores FEATURE_IMPLEMENTED when isReplay is true", async () => {
      const queue = new AsyncEventQueue();
      // const broadcasts: Array<{ type: string; payload: unknown }> = []; // Removed
      // const hub = { // Removed
      //   broadcast: async (e: { type: string; payload: unknown }) => {
      //     broadcasts.push({ type: e.type, payload: e.payload });
      //   },
      // };

      const config: DuctusConfig = {
        default: {
          checks: {
            e2e: { command: "npm run e2e", boundary: "per_feature" as const },
          },
          roles: {
            planner: {
              lifecycle: "single-shot",
              maxRejections: 3,
              maxRecognizedHallucinations: 0,
              strategies: [{ id: "p", model: "claude", template: "p" }],
            },
            engineer: {
              lifecycle: "session",
              maxRejections: 5,
              maxRecognizedHallucinations: 2,
              strategies: [{ id: "e", model: "claude", template: "e" }],
            },
          },
        },
        scopes: {},
      };

      const processor = new QualityProcessor(config, "/tmp");
      const outStream = processor.process(queue as any);
      const yielded: any[] = [];

      queue.push({
        eventId: VALID_UUID,
        type: "FEATURE_IMPLEMENTED",
        payload: { files: ["y.ts"] },
        authorId: "development-processor",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: VALID_SHA256,
        hash: VALID_SHA256,
        volatility: "durable" as const,
        isReplay: true,
      });
      queue.close();

      for await (const e of outStream) {
        yielded.push(e);
      }

      const effectRunTools = yielded.filter((b) => b.type === "EFFECT_RUN_TOOL");
      expect(effectRunTools).toHaveLength(0);
    });
  });
});
