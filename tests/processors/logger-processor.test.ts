/**
 * LoggerProcessor Definition of Done.
 * Task 005-logger-processor.
 */

import { LoggerProcessor } from "../../src/processors/logger-processor.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import type { TerminalAdapter } from "../../src/interfaces/adapters.js";
import type { CommitedEvent } from "../../src/core/event-contracts.js";
import type { InputEventStream } from "../../src/interfaces/input-event-stream.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockCommitedEvent(
  type: string,
  volatility: "durable" | "volatile",
  payload: unknown = {}
): CommitedEvent & { isReplay?: boolean } {
  return {
    eventId: VALID_UUID,
    type,
    payload,
    authorId: "proc-1",
    timestamp: 0,
    sequenceNumber: 1,
    prevHash: VALID_SHA256,
    hash: VALID_SHA256,
    volatility,
  };
}

async function flushStream<T>(stream: AsyncIterable<T>): Promise<void> {
  for await (const _ of stream) {
    /* sink consumes until done */
  }
}

describe("LoggerProcessor", () => {
  describe("The Silence Proof", () => {
    it("drops all events with isReplay: true; log is never invoked", async () => {
      const logCalls: string[] = [];
      const mockTerminalAdapter: TerminalAdapter = {
        ask: async () => ({} as never),
        confirm: async () => false,
        log: (msg) => {
          logCalls.push(msg);
        },
      };

      const queue = new AsyncEventQueue();
      const processor = new LoggerProcessor(mockTerminalAdapter, queue);

      const events: (CommitedEvent & { isReplay?: boolean })[] = [
        mockCommitedEvent("EVENT_A", "durable"),
        mockCommitedEvent("EVENT_B", "durable"),
        mockCommitedEvent("EVENT_C", "durable"),
        mockCommitedEvent("EVENT_D", "durable"),
        mockCommitedEvent("EVENT_E", "durable"),
      ];
      for (const e of events) {
        e.isReplay = true;
        queue.push(e);
      }
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      expect(logCalls).toHaveLength(0);
    });
  });

  describe("The Output Routing Proof", () => {
    it("AGENT_TOKEN_STREAM volatile event: log invoked with exact text chunk from payload", async () => {
      const logCalls: string[] = [];
      const mockTerminalAdapter: TerminalAdapter = {
        ask: async () => ({} as never),
        confirm: async () => false,
        log: (msg) => {
          logCalls.push(msg);
        },
      };

      const queue = new AsyncEventQueue();
      const processor = new LoggerProcessor(mockTerminalAdapter, queue);

      const chunk = "Hello, world!";
      const event = mockCommitedEvent("AGENT_TOKEN_STREAM", "volatile", {
        chunk,
      });
      queue.push(event);
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      expect(logCalls).toHaveLength(1);
      expect(logCalls[0]).toBe(chunk);
    });
  });
});
