/**
 * ToolProcessor Definition of Done.
 * Task 010-tool-processor.
 */

import { ToolProcessor } from "../../research/processors/tool-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { OSAdapter } from "../../research/interfaces/adapters.js";
import type { InputEventStream } from "../../research/interfaces/input-event-stream.js";

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink */
  }
}

describe("ToolProcessor", () => {
  describe("The Hydration Pass-through Proof", () => {
    it("EFFECT_RUN_TOOL with isReplay: true never invokes OSAdapter", async () => {
      const execCalls: Array<[string, string[], { timeoutMs: number; cwd: string }]> = [];
      const mockOsAdapter: OSAdapter = {
        exec: async (cmd, args, opts) => {
          execCalls.push([cmd, args, opts]);
          return { stdout: "", stderr: "", exitCode: 0 };
        },
      };

      const queue = new AsyncEventQueue();
      const processor = new ToolProcessor(
        mockOsAdapter,
        process.cwd()
      );

      queue.push({
        eventId: "e1",
        type: "EFFECT_RUN_TOOL",
        payload: { command: "echo", args: ["hello"] },
        authorId: "dev",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: "a",
        hash: "b",
        volatility: "durable" as const,
        isReplay: true,
      });
      queue.close();

      const yielded: any[] = [];
      for await (const ev of processor.process(queue as any)) {
        yielded.push(ev);
      }

      expect(execCalls).toHaveLength(0);
    });
  });

  describe("The Atomic Aggregate Proof", () => {
    it("yields exactly one TOOL_COMPLETED with aggregated log ABC", async () => {
      const mockOsAdapter: OSAdapter = {
        exec: async () => ({
          stdout: "ABC",
          stderr: "",
          exitCode: 0,
        }),
      };

      const queue = new AsyncEventQueue();
      const processor = new ToolProcessor(
        mockOsAdapter,
        process.cwd()
      );

      queue.push({
        eventId: "e1",
        type: "EFFECT_RUN_TOOL",
        payload: { command: "cmd", args: [] },
        authorId: "dev",
        timestamp: 1000,
        sequenceNumber: 1,
        prevHash: "a",
        hash: "b",
        volatility: "durable" as const,
      });
      queue.close();

      const yielded: any[] = [];
      for await (const ev of processor.process(queue as any)) {
        yielded.push(ev);
      }

      const completed = yielded.filter((b) => b.type === "TOOL_COMPLETED");
      expect(completed).toHaveLength(1);
      expect((completed[0]!.payload as { log: string }).log).toBe("ABC");
    });
  });
});
