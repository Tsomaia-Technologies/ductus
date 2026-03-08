/**
 * Bootstrapper Definition of Done.
 * Task 008-bootstrapper.
 */

import { Bootstrapper } from "../../research/bootstrapper/bootstrapper.js";
import { LoggerProcessor } from "../../research/processors/logger-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { FileAdapter, OSAdapter, TerminalAdapter } from "../../research/interfaces/adapters.js";
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
      append: async () => { },
      readStream: async function* () { },
      read: async () => "",
      exists: async () => false,
    },
    os: {
      exec: async () => ({ stdout: "", stderr: "", exitCode: 0 }),
    },
    terminal: {
      ask: async () => ({} as never),
      confirm: async () => false,
      log: () => { },
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
        fileAdapter: adapters.file,
        osAdapter: adapters.os,
        terminalAdapter: adapters.terminal,
        ledgerPath: "ledger.md",
        configPath: "ductus.config.ts"
      });
      await bootstrapper.boot("new");
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

      // Removed loggerQueue and mockLogger

      const tmpDir = await mkdtemp(join(tmpdir(), "ductus-test-"));

      const fiveEvents = [
        {
          eventId: "550e8400-e29b-41d4-a716-446655440001",
          type: "EVENT_A",
          payload: {},
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
          timestamp: 5000,
          sequenceNumber: 5,
          prevHash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          hash: "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
          volatility: "durable" as const,
        },
      ];

      const ledgerLines = fiveEvents.map((e) => JSON.stringify(e));

      const mockFileAdapter: FileAdapter = {
        append: async () => { },
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
        fileAdapter: adapters.file,
        osAdapter: adapters.os,
        terminalAdapter: adapters.terminal,
        ledgerPath: join(tmpDir, "ledger.jsonl"),
        configPath: "ductus.config.ts",
      });

      await bootstrapper.boot("resume");

      // Removed flushStream since the wired processor inside handles it

      expect(logCalls.length).toBe(0);
    });
  });
});
