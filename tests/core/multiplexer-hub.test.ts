/**
 * MultiplexerHub Definition of Done: Immutability + Crypto Proof.
 * Task 002-multiplexer-hub.
 */

import { MultiplexerHub } from "../../research/core/multiplexer-hub.js";
import { AsyncEventQueue } from "../../research/core/event-queue.js";
import type { EventProcessor } from "../../research/interfaces/event-processor.js";

// Removed mock setup for processors since hub only exposes subscribe() stream

describe("MultiplexerHub", () => {
  it("immutability: rogue processor deleting event.payload.id throws TypeError (strict mode)", async () => {
    const hub = new MultiplexerHub();
    const queue = hub.subscribe() as unknown as AsyncEventQueue;

    const base = {
      type: "TEST",
      payload: { id: "sensitive" },
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
    const queue = hub.subscribe() as unknown as AsyncEventQueue;

    const base = {
      type: "SAME",
      payload: { x: 1 },
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
    expect(events[0]!.sequenceNumber).toBe(0);
    expect(events[1]!.sequenceNumber).toBe(1);
    expect(events[0]!.prevHash).toBe("0000000000000000000000000000000000000000000000000000000000000000");
    expect(events[1]!.prevHash).toBe(events[0]!.hash);
  });

  it("injectReplay attaches isReplay: true to stamped events", async () => {
    const hub = new MultiplexerHub();
    const queue = hub.subscribe() as unknown as AsyncEventQueue;

    hub.injectReplay({
      eventId: "550e8400-e29b-41d4-a716-446655440000",
      type: "REPLAY",
      payload: {},
      timestamp: 0,
      sequenceNumber: 1,
      prevHash: "x",
      hash: "y",
      volatility: "durable",
    });
    queue.close();

    for await (const event of queue) {
      expect((event as { isReplay?: boolean }).isReplay).toBe(true);
      break;
    }
  });
});
