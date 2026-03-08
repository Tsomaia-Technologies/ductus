/**
 * SessionProcessor Definition of Done.
 * Task 012-session-processor.
 */

import { SessionProcessor } from "../../research/processors/session-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { FileAdapter } from "../../research/interfaces/adapters.js";
import type { InputEventStream } from "../../research/interfaces/input-event-stream.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockEnqueuedEvent(type: string, isReplay = false): Parameters<AsyncEventQueue["push"]>[0] {
  return {
    eventId: VALID_UUID,
    type,
    payload: {},
    timestamp: 0,
    sequenceNumber: 1,
    prevHash: VALID_SHA256,
    hash: VALID_SHA256,
    volatility: "durable" as const,
    isReplay,
  };
}

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink */
  }
}

describe("SessionProcessor", () => {
  describe("The Config Crash Proof", () => {
    it("malformed config (missing roles): yields SYSTEM_ABORT_REQUESTED with Zod parsing failure", async () => {
      const configPath = "/project/ductus.config.json";
      const ledgerPath = "/project/ledger.jsonl";

      const readCalls: string[] = [];
      const mockFileAdapter: FileAdapter = {
        exists: async (path) => path === configPath,
        read: async (path) => {
          readCalls.push(path);
          return '{"default":{"checks":{}}}';
        },
        append: async () => { },
        readStream: async function* () { },
      };

      const queue = new AsyncEventQueue();
      const processor = new SessionProcessor(mockFileAdapter, configPath, ledgerPath);

      queue.push(mockEnqueuedEvent("SYSTEM_START"));
      queue.close();

      const yielded: any[] = [];
      for await (const ev of processor.process(queue as any)) {
        yielded.push(ev);
      }

      const abort = yielded.filter((b) => b.type === "SYSTEM_ABORT_REQUESTED");
      expect(abort).toHaveLength(1);
      const payload = abort[0]!.payload as { reason: string };
      expect(payload.reason).toContain("roles");
      expect(payload.reason).toMatch(/default|validation|required/i);
    });
  });

  describe("The Genesis Path", () => {
    it("config and ledger do not exist: CONTEXT_LOADED contains isGenesis: true", async () => {
      const configPath = "/project/ductus.config.json";
      const ledgerPath = "/project/ledger.jsonl";

      const mockFileAdapter: FileAdapter = {
        exists: async () => false,
        read: async () => {
          throw new Error("read should not be called");
        },
        append: async () => { },
        readStream: async function* () { },
      };

      const queue = new AsyncEventQueue();
      const processor = new SessionProcessor(mockFileAdapter, configPath, ledgerPath);

      queue.push(mockEnqueuedEvent("SYSTEM_START"));
      queue.close();

      const yielded: any[] = [];
      for await (const ev of processor.process(queue as any)) {
        yielded.push(ev);
      }

      const loaded = yielded.filter((b) => b.type === "CONTEXT_LOADED");
      expect(loaded).toHaveLength(1);
      const payload = loaded[0]!.payload as { config: unknown; isGenesis: boolean };
      expect(payload.isGenesis).toBe(true);
      expect(payload.config).toBeDefined();
    });
  });
});
