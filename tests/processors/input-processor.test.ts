/**
 * InputProcessor Definition of Done.
 * Task 011-input-processor.
 */

import { InputProcessor } from "../../src/processors/input-processor.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import type { TerminalAdapter } from "../../src/interfaces/adapters.js";
import type { InputEventStream } from "../../src/interfaces/input-event-stream.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockEnqueuedEvent(
  type: string,
  payload: unknown,
  isReplay = false
): Parameters<AsyncEventQueue["push"]>[0] {
  return {
    eventId: VALID_UUID,
    type,
    payload,
    authorId: "state-machine",
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

describe("InputProcessor", () => {
  describe("The Hydration Filter Test", () => {
    it("REQUEST_INPUT with isReplay: true: TerminalAdapter.ask never invoked", async () => {
      const askCalls: Array<[string, unknown]> = [];
      const confirmCalls: string[] = [];
      const mockTerminalAdapter: TerminalAdapter = {
        ask: async (question, schema) => {
          askCalls.push([question, schema]);
          return "unreachable" as never;
        },
        confirm: async (message) => {
          confirmCalls.push(message);
          return false;
        },
        log: () => {},
      };

      const broadcasts: Array<{ type: string; payload: unknown }> = [];
      const mockHub = {
        broadcast: async (e: { type: string; payload: unknown }) => {
          broadcasts.push({ type: e.type, payload: e.payload });
        },
      };

      const queue = new AsyncEventQueue();
      const processor = new InputProcessor(
        mockHub,
        mockTerminalAdapter,
        queue
      );

      queue.push(
        mockEnqueuedEvent(
          "REQUEST_INPUT",
          { id: "q1", question: "Proceed?", expectedSchemaType: "string" },
          true
        )
      );
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      expect(askCalls).toHaveLength(0);
      expect(confirmCalls).toHaveLength(0);
    });
  });

  describe("The Type Safety Test", () => {
    it("REQUEST_INPUT with expectedSchemaType boolean: yields INPUT_RECEIVED with payload.answer === true", async () => {
      const mockTerminalAdapter: TerminalAdapter = {
        ask: async () => "unreachable" as never,
        confirm: async () => true,
        log: () => {},
      };

      const broadcasts: Array<{ type: string; payload: unknown }> = [];
      const mockHub = {
        broadcast: async (e: { type: string; payload: unknown }) => {
          broadcasts.push({ type: e.type, payload: e.payload });
        },
      };

      const queue = new AsyncEventQueue();
      const processor = new InputProcessor(
        mockHub,
        mockTerminalAdapter,
        queue
      );

      queue.push(
        mockEnqueuedEvent("REQUEST_INPUT", {
          id: "approve-spec",
          question: "Approve this spec?",
          expectedSchemaType: "boolean",
        })
      );
      queue.close();

      await flushStream(processor.process(queue as unknown as InputEventStream));

      const received = broadcasts.filter((b) => b.type === "INPUT_RECEIVED");
      expect(received).toHaveLength(1);
      const payload = received[0]!.payload as { id: string; answer: unknown };
      expect(payload.answer).toBe(true);
      expect(payload.id).toBe("approve-spec");
    });
  });
});
