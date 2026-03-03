/**
 * AgentProcessor Definition of Done.
 * Task 015-agent-processor.
 */

import { AgentProcessor } from "../../research/processors/agent-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { FileAdapter } from "../../research/interfaces/adapters.js";
import type { CacheAdapter } from "../../research/interfaces/cache-adapter.js";
import type { AgentDispatcher } from "../../research/interfaces/agent-dispatcher.js";

async function flushStream<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const x of stream) {
    out.push(x);
  }
  return out;
}

describe("AgentProcessor", () => {
  describe("The Hash Cache Proof", () => {
    it("yields AGENT_REPORT_RECEIVED from cache without calling FileAdapter or AgentDispatcher", async () => {
      const fileReadCalls: string[] = [];
      const mockFileAdapter: FileAdapter = {
        append: async () => { },
        readStream: async function* () { },
        read: async (path) => {
          fileReadCalls.push(path);
          return "";
        },
        exists: async () => true,
      };

      const dispatcherProcessCalls: unknown[] = [];
      const mockDispatcher = {
        process: async function* (input: string, role: unknown, context: unknown, options: unknown) {
          dispatcherProcessCalls.push({ input, role, context, options });
          yield { type: "token" as const, content: "x" };
          yield { type: "complete" as const, parsedOutput: { files: ["b.ts"] } };
        },
        terminate: () => { },
      } as AgentDispatcher;

      const cache = new Map<string, unknown>();
      cache.set("X123", { files: ["hi.ts"] });
      const mockCache: CacheAdapter = {
        get: async <T>(key: string): Promise<T | undefined> =>
          cache.get(key) as T | undefined,
        set: async (key, val) => {
          cache.set(key, val);
        },
      };

      const config = {
        default: {
          checks: {},
          roles: {
            engineer: {
              lifecycle: "session" as const,
              maxRejections: 3,
              maxRecognizedHallucinations: 2,
              strategies: [{ id: "s1", model: "claude", template: "./eng.mx" }],
            },
          },
        },
        scopes: {},
      };

      const queue = new AsyncEventQueue();
      const processor = new AgentProcessor(
        config,
        mockDispatcher,
        mockFileAdapter,
        mockCache,
        process.cwd()
      );

      queue.push({
        eventId: "e1",
        type: "EFFECT_SPAWN_AGENT",
        payload: {
          roleName: "engineer",
          scope: "default",
          input: "do x",
        },
        authorId: "dev",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: "a",
        hash: "X123",
        volatility: "durable" as const,
      });
      queue.close();

      const yielded = await flushStream(processor.process(queue));

      const durable = yielded.filter((b) => b.type === "AGENT_RESPONSE");
      expect(durable).toHaveLength(1);
      expect((durable[0]!.payload as { filesModified: string[] }).filesModified).toEqual(["hi.ts"]);

      expect(fileReadCalls).toHaveLength(0);
      expect(dispatcherProcessCalls).toHaveLength(0);
    });
  });

  describe("The Panic Sequence Proof", () => {
    it("CIRCUIT_INTERRUPTED aborts stream; no durable events emitted", async () => {
      const { AgentDispatcherImpl } = await import("../../research/agents/agent-dispatcher.js");
      const { MockLLMProvider } = await import("../../research/agents/mock-llm-provider.js");

      const dispatcher = new AgentDispatcherImpl({
        tokenCounter: () => 50,
        provider: new MockLLMProvider({
          tokenDelayMs: 100,
          response: '{"files":["x.ts"]}',
        }),
        strategies: [{ id: "s1", model: "claude", template: "" }],
      });

      const mockFileAdapter: FileAdapter = {
        append: async () => { },
        readStream: async function* () { },
        read: async () => "template",
        exists: async () => true,
      };

      const mockCache: CacheAdapter = {
        get: async () => undefined,
        set: async () => { },
      };

      const config = {
        default: {
          checks: {},
          roles: {
            engineer: {
              lifecycle: "session" as const,
              maxRejections: 3,
              maxRecognizedHallucinations: 2,
              strategies: [{ id: "s1", model: "claude", template: "./eng.mx" }],
            },
          },
        },
        scopes: {},
      };

      const queue = new AsyncEventQueue();
      const processor = new AgentProcessor(
        config,
        dispatcher,
        mockFileAdapter,
        mockCache,
        process.cwd()
      );

      queue.push({
        eventId: "e1",
        type: "EFFECT_SPAWN_AGENT",
        payload: {
          roleName: "engineer",
          scope: "default",
          input: "x",
        },
        authorId: "dev",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: "a",
        hash: "h1",
        volatility: "durable" as const,
      });
      await new Promise((r) => setTimeout(r, 50));
      queue.push({
        eventId: "e2",
        type: "CIRCUIT_INTERRUPTED",
        payload: {},
        authorId: "int",
        timestamp: 1001,
        sequenceNumber: 2,
        prevHash: "b",
        hash: "h2",
        volatility: "durable" as const,
      });
      queue.close();

      const yielded = await flushStream(processor.process(queue));

      const durable = yielded.filter(
        (b) =>
          b.type === "AGENT_REPORT_RECEIVED" || b.type === "AGENT_FAILURE"
      );
      expect(durable).toHaveLength(0);
    });
  });
});
