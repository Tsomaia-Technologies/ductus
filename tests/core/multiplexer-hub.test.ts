/**
 * MultiplexerHub Definition of Done: Immutability + Crypto Proof.
 * Task 002-multiplexer-hub.
 */

import { MultiplexerHub } from "../../src/core/multiplexer-hub.js";
import { AsyncEventQueue } from "../../src/core/event-queue.js";
import type { EventProcessor } from "../../src/interfaces/event-processor.js";

function createProcessorWithQueue(): {
  processor: EventProcessor;
  queue: AsyncEventQueue;
} {
  const queue = new AsyncEventQueue();
  const processor: EventProcessor = {
    incomingQueue: queue,
    process: () => (async function* () {})() as ReturnType<EventProcessor["process"]>,
  };
  return { processor, queue };
}

describe("MultiplexerHub", () => {
  it("immutability: rogue processor deleting event.payload.id throws TypeError (strict mode)", async () => {
    const hub = new MultiplexerHub();
    const { processor, queue } = createProcessorWithQueue();
    hub.register(processor);

    const base = {
      type: "TEST",
      payload: { id: "sensitive" },
      authorId: "proc-1",
      timestamp: 0,
      volatility: "durable-draft" as const,
    };

    hub.broadcast(base);
    queue.close();

    let received: { payload: unknown } | null = null;
    for await (const event of queue) {
      received = event;
      break;
    }

    expect(received).not.toBeNull();
    const payload = received!.payload as { id?: string };
    expect(payload).toHaveProperty("id", "sensitive");

    expect(() => {
      "use strict";
      delete payload.id;
    }).toThrow(TypeError);
  });

  it("crypto proof: two identical BaseEvents yield different CommitedEvent hashes", async () => {
    const hub = new MultiplexerHub();
    const { processor, queue } = createProcessorWithQueue();
    hub.register(processor);

    const base = {
      type: "SAME",
      payload: { x: 1 },
      authorId: "a",
      timestamp: 0,
      volatility: "durable-draft" as const,
    };

    hub.broadcast(base);
    hub.broadcast(base);
    queue.close();

    const events: Array<{ hash: string; sequenceNumber: number; prevHash: string }> = [];
    for await (const event of queue) {
      events.push({ hash: event.hash, sequenceNumber: event.sequenceNumber, prevHash: event.prevHash });
      if (events.length >= 2) break;
    }

    expect(events).toHaveLength(2);
    expect(events[0]!.hash).not.toBe(events[1]!.hash);
    expect(events[0]!.sequenceNumber).toBe(1);
    expect(events[1]!.sequenceNumber).toBe(2);
    expect(events[0]!.prevHash).toBe("genesis");
    expect(events[1]!.prevHash).toBe(events[0]!.hash);
  });

  it("SilentMode attaches isReplay: true to stamped events", async () => {
    const hub = new MultiplexerHub();
    hub.mode = "SilentMode";
    const { processor, queue } = createProcessorWithQueue();
    hub.register(processor);

    hub.broadcast({
      type: "REPLAY",
      payload: {},
      authorId: "a",
      timestamp: 0,
      volatility: "durable-draft" as const,
    });
    queue.close();

    for await (const event of queue) {
      expect((event as { isReplay?: boolean }).isReplay).toBe(true);
      break;
    }
  });
});
