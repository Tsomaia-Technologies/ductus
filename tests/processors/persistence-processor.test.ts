/**
 * PersistenceProcessor Definition of Done.
 * Task 004-persistence-processor.
 */

import { PersistenceProcessor } from "../../research/processors/persistence-processor.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { FileAdapter } from "../../research/interfaces/adapters.js";
import type { CommittedEvent } from "../../research/interfaces/event.js";
import type { InputEventStream } from "../../research/interfaces/input-event-stream.js";

const VALID_SHA256 =
  "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3";
const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

function mockCommittedEvent(volatility: "durable" | "volatile"): CommittedEvent & { isReplay?: boolean } {
  return {
    eventId: VALID_UUID,
    type: "TEST",
    payload: {},
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

describe("PersistenceProcessor", () => {
  describe("The Volatility Proof", () => {
    it("writes only durable events; volatile events are silently ignored", async () => {
      const appendCalls: Array<[string, string]> = [];
      const mockFileAdapter: FileAdapter = {
        append: async (path, line) => {
          appendCalls.push([path, line]);
        },
        readStream: async function* () {},
        read: async () => "",
        exists: async () => false,
      };

      const ledgerPath = "/tmp/ledger.jsonl";
      const queue = new AsyncEventQueue();
      const processor = new PersistenceProcessor(mockFileAdapter, ledgerPath);

      const events: (CommittedEvent & { isReplay?: boolean })[] = [
        mockCommittedEvent("durable"),
        mockCommittedEvent("volatile"),
        mockCommittedEvent("durable"),
        mockCommittedEvent("volatile"),
        mockCommittedEvent("durable"),
      ];

      for (const e of events) {
        queue.push(e);
      }
      queue.close();

      await flushStream(processor.process(queue as any));

      expect(appendCalls).toHaveLength(3);
      for (const [path, line] of appendCalls) {
        expect(path).toBe(ledgerPath);
        const parsed = JSON.parse(line);
        expect(parsed.volatility).toBe("durable");
      }
    });
  });

  describe("The Replay Amnesia Proof", () => {
    it("drops durable events with isReplay: true; append is never called", async () => {
      const appendCalls: Array<[string, string]> = [];
      const mockFileAdapter: FileAdapter = {
        append: async (path, line) => {
          appendCalls.push([path, line]);
        },
        readStream: async function* () {},
        read: async () => "",
        exists: async () => false,
      };

      const ledgerPath = "/tmp/ledger-replay.jsonl";
      const queue = new AsyncEventQueue();
      const processor = new PersistenceProcessor(mockFileAdapter, ledgerPath);

      const durableReplay = mockCommittedEvent("durable");
      durableReplay.isReplay = true;

      queue.push(durableReplay);
      queue.close();

      await flushStream(processor.process(queue as any));

      expect(appendCalls).toHaveLength(0);
    });
  });
});
