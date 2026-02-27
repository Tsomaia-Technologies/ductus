/**
 * Bootstrapper Definition of Done.
 * Task 008-bootstrapper.
 */

import { Bootstrapper } from "../../src/bootstrapper/bootstrapper.js";
import { LoggerProcessor } from "../../src/processors/logger-processor.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import type { FileAdapter, OSAdapter, TerminalAdapter } from "../../src/interfaces/adapters.js";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

function createMockAdapters(): {
  file: FileAdapter;
  os: OSAdapter;
  terminal: TerminalAdapter;
} {
  return {
    file: {
      append: async () => {},
      readStream: async function* () {},
      read: async () => "",
      exists: async () => false,
    },
    os: {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    },
    terminal: {
      ask: async () => ({} as never),
      confirm: async () => false,
      log: () => {},
    },
  };
}

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink */
  }
}

describe("Bootstrapper", () => {
  describe("The DI Wiring Proof", () => {
    it("compiles and chains all 10 Processors into Hub.register without TypeScript errors", async () => {
      const adapters = createMockAdapters();
      const bootstrapper = new Bootstrapper({
        cwd: process.cwd(),
        adapterOverrides: adapters,
      });
      await bootstrapper.ignite();
      expect(bootstrapper).toBeDefined();
    });
  });

  describe("The Muted Hydration Proof", () => {
    it("LoggerProcessor does not log during hydration when SilentMode replays 5 historical events", async () => {
      const logCalls: string[] = [];
      const mockTerminalAdapter = {
        ask: async () => ({} as never),
        confirm: async () => false,
        log: (msg: string) => {
          logCalls.push(msg);
        },
      };

      const loggerQueue = new AsyncEventQueue();
      const mockLogger = new LoggerProcessor(mockTerminalAdapter, loggerQueue);

      const tmpDir = await mkdtemp(join(tmpdir(), "ductus-test-"));

      const fiveEvents = [
        {
          eventId: "550e8400-e29b-41d4-a716-446655440001",
          type: "EVENT_A",
          payload: {},
          authorId: "test",
          timestamp: 1000,
          sequenceNumber: 1,
          prevHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          volatility: "durable" as const,
        },
        {
          eventId: "550e8400-e29b-41d4-a716-446655440002",
          type: "EVENT_B",
          payload: {},
          authorId: "test",
          timestamp: 2000,
          sequenceNumber: 2,
          prevHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          volatility: "durable" as const,
        },
        {
          eventId: "550e8400-e29b-41d4-a716-446655440003",
          type: "EVENT_C",
          payload: {},
          authorId: "test",
          timestamp: 3000,
          sequenceNumber: 3,
          prevHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          volatility: "durable" as const,
        },
        {
          eventId: "550e8400-e29b-41d4-a716-446655440004",
          type: "EVENT_D",
          payload: {},
          authorId: "test",
          timestamp: 4000,
          sequenceNumber: 4,
          prevHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          volatility: "durable" as const,
        },
        {
          eventId: "550e8400-e29b-41d4-a716-446655440005",
          type: "EVENT_E",
          payload: {},
          authorId: "test",
          timestamp: 5000,
          sequenceNumber: 5,
          prevHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          volatility: "durable" as const,
        },
      ];

      const ledgerLines = fiveEvents.map((e) => JSON.stringify(e));

      const mockFileAdapter: FileAdapter = {
        append: async () => {},
        readStream: async function* () {
          for (const line of ledgerLines) yield line;
        },
        read: async () => ledgerLines.join("\n"),
        exists: async () => true,
      };

      const adapters = createMockAdapters();
      adapters.file = mockFileAdapter;

      const bootstrapper = new Bootstrapper({
        cwd: tmpDir,
        processorOverrides: { logger: mockLogger },
        adapterOverrides: adapters,
      });

      await bootstrapper.ignite();

      loggerQueue.close();
      await flushStream(
        mockLogger.process(loggerQueue as Parameters<typeof mockLogger.process>[0])
      );

      expect(logCalls.length).toBe(0);
    });
  });
});
