/**
 * DevelopmentProcessor Definition of Done.
 * Task 016-development-processor.
 */

import { DevelopmentProcessor } from "../../src/processors/development-processor.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import type { DuctusConfig } from "../../src/core/ductus-config-schema.js";
import type { EventQueue } from "../../src/interfaces/event-queue.js";
import type { InputEventStream } from "../../src/interfaces/input-event-stream.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink */
  }
}

function createMockHubWithToolResponse(
  queue: EventQueue,
  gitDiffStdout: string,
  checkExitCode = 0
) {
  const broadcasts: Array<{ type: string; payload: unknown }> = [];
  return {
    broadcasts,
    hub: {
      broadcast: async (e: { type: string; payload: unknown }) => {
        broadcasts.push({ type: e.type, payload: e.payload });
        const p = e.payload as { command?: string; trackingId?: string; args?: string[] };
        if (e.type === "EFFECT_RUN_TOOL" && p?.trackingId) {
          const cmd = p.command;
          const args = p.args ?? [];
          if (cmd === "git" && args[0] === "diff") {
            queue.push({
              eventId: VALID_UUID,
              type: "TOOL_COMPLETED",
              payload: {
                trackingId: p.trackingId,
                exitCode: 0,
                stdout: gitDiffStdout,
                stderr: "",
                log: gitDiffStdout,
              },
              authorId: "tool-processor",
              timestamp: Date.now(),
              sequenceNumber: 1,
              prevHash: "a".repeat(64),
              hash: "b".repeat(64),
              volatility: "durable" as const,
            });
          } else {
            queue.push({
              eventId: VALID_UUID,
              type: "TOOL_COMPLETED",
              payload: {
                trackingId: p.trackingId,
                exitCode: checkExitCode,
                stdout: "",
                stderr: "",
                log: "",
              },
              authorId: "tool-processor",
              timestamp: Date.now(),
              sequenceNumber: 1,
              prevHash: "a".repeat(64),
              hash: "b".repeat(64),
              volatility: "durable" as const,
            });
          }
        }
      },
    },
  };
}

describe("DevelopmentProcessor", () => {
  describe("The True Hallucination Proof", () => {
    it("yields AUTO_REJECTION when Agent claims [a.ts] but git diff returns [a.ts, b.ts]", async () => {
      const queue = new AsyncEventQueue();
      const { broadcasts, hub } = createMockHubWithToolResponse(queue, "a.ts\nb.ts");

      const config: DuctusConfig = {
        default: {
          checks: {},
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

      const processor = new DevelopmentProcessor(hub, config, "/tmp", queue);

      queue.push({
        eventId: VALID_UUID,
        type: "AGENT_REPORT_RECEIVED",
        payload: { files: ["a.ts"] },
        authorId: "agent-processor",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
        volatility: "durable" as const,
      });
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      const autoRejections = broadcasts.filter((b) => b.type === "AUTO_REJECTION");
      expect(autoRejections).toHaveLength(1);
      const payload = autoRejections[0]!.payload as { isHallucination?: boolean; reason?: string };
      expect(payload.isHallucination).toBe(true);
      expect(payload.reason).toBe("diff_mismatch");
    });
  });

  describe("The Interpolation Proof", () => {
    it("yields EFFECT_RUN_TOOL with interpolated command npx eslint x.ts", async () => {
      const queue = new AsyncEventQueue();
      const { broadcasts, hub } = createMockHubWithToolResponse(queue, "x.ts");

      const config: DuctusConfig = {
        default: {
          checks: {
            lint: {
              command: "npx eslint {{files}}",
              boundary: "per_iteration",
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

      const processor = new DevelopmentProcessor(hub, config, "/tmp", queue);

      queue.push({
        eventId: VALID_UUID,
        type: "AGENT_REPORT_RECEIVED",
        payload: { files: ["x.ts"] },
        authorId: "agent-processor",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: "a".repeat(64),
        hash: "b".repeat(64),
        volatility: "durable" as const,
      });
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      const effectRunTools = broadcasts.filter((b) => b.type === "EFFECT_RUN_TOOL");
      const gitDiffEffect = effectRunTools.find(
        (b) =>
          (b.payload as { command?: string }).command === "git" &&
          ((b.payload as { args?: string[] }).args ?? [])[0] === "diff"
      );
      expect(gitDiffEffect).toBeDefined();

      const checkEffect = effectRunTools.find(
        (b) => (b.payload as { command?: string }).command === "npx"
      );
      expect(checkEffect).toBeDefined();
      const checkPayload = checkEffect!.payload as { command: string; args: string[] };
      const interpolatedString =
        checkPayload.command + (checkPayload.args?.length ? " " + checkPayload.args.join(" ") : "");
      expect(interpolatedString).toBe("npx eslint x.ts");
    });
  });

  describe("Muted Mode Protection", () => {
    it("ignores AGENT_REPORT_RECEIVED when isReplay is true", async () => {
      const queue = new AsyncEventQueue();
      const broadcasts: Array<{ type: string; payload: unknown }> = [];
      const hub = {
        broadcast: async (e: { type: string; payload: unknown }) => {
          broadcasts.push({ type: e.type, payload: e.payload });
        },
      };

      const config: DuctusConfig = {
        default: {
          checks: {},
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

      const processor = new DevelopmentProcessor(hub, config, "/tmp", queue);

      queue.push({
        eventId: VALID_UUID,
        type: "AGENT_REPORT_RECEIVED",
        payload: { files: ["a.ts"] },
        authorId: "agent-processor",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: VALID_SHA256,
        hash: VALID_SHA256,
        volatility: "durable" as const,
        isReplay: true,
      });
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      const effectRunTools = broadcasts.filter((b) => b.type === "EFFECT_RUN_TOOL");
      expect(effectRunTools).toHaveLength(0);
    });
  });
});
