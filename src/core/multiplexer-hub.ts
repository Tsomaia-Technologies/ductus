/**
 * Multiplexer Hub - The concurrent spine of the Event Sourcing pipeline.
 * Receives BaseEvents, stamps into CommitedEvents, freezes payload, fan-out broadcasts.
 * RFC-001 Impl Guide, Task 002-multiplexer-hub.
 */

import { createHash, randomUUID } from "node:crypto";
import type { BaseEvent, CommitedEvent } from "./event-contracts.js";
import type { EventProcessor } from "../interfaces/event-processor.js";

export type HubMode = "LiveMode" | "SilentMode";

const GENESIS_HASH = "genesis";

/**
 * Computes SHA-256 hex of: prevHash + authorId + sequenceNumber + stringified payload.
 * Matches RFC 4.1: hash = SHA-256(prevHash + authorId + sequenceNumber + JSON.stringify(payload))
 */
function computeHash(
  prevHash: string,
  authorId: string,
  sequenceNumber: number,
  payload: unknown
): string {
  const data =
    prevHash + authorId + String(sequenceNumber) + JSON.stringify(payload);
  return createHash("sha256").update(data).digest("hex");
}

/** Maps draft volatility to committed form. */
function toCommittedVolatility(
  v: "durable-draft" | "volatile-draft"
): "durable" | "volatile" {
  return v === "durable-draft" ? "durable" : "volatile";
}

export class MultiplexerHub {
  private readonly processors: EventProcessor[] = [];
  private sequenceNumber = 0;
  private lastHash = GENESIS_HASH;
  private _mode: HubMode = "LiveMode";

  get mode(): HubMode {
    return this._mode;
  }

  set mode(value: HubMode) {
    this._mode = value;
  }

  register(processor: EventProcessor): void {
    this.processors.push(processor);
  }

  /**
   * Injects a pre-stamped CommitedEvent during replay. Does not re-stamp.
   * Used by Bootstrapper for hydration.
   */
  injectReplay(event: CommitedEvent & { isReplay?: boolean }): void {
    const replay = { ...event, isReplay: true };
    Object.freeze(replay);
    const len = this.processors.length;
    for (let i = 0; i < len; i++) {
      this.processors[i]!.incomingQueue.push(replay);
    }
  }

  /**
   * Stamps BaseEvent into CommitedEvent, freezes payload, fan-out broadcast.
   * Fire-and-forget: does NOT await processor completion.
   */
  async broadcast(base: BaseEvent): Promise<void> {
    this.sequenceNumber += 1;
    const prevHash = this.lastHash;

    const payload = base.payload;
    if (payload !== null && typeof payload === "object") {
      Object.freeze(payload);
    }

    const hash = computeHash(
      prevHash,
      base.authorId,
      this.sequenceNumber,
      payload
    );
    this.lastHash = hash;

    const committed: CommitedEvent & { isReplay?: boolean } = {
      eventId: randomUUID(),
      type: base.type,
      payload,
      authorId: base.authorId,
      timestamp: base.timestamp,
      sequenceNumber: this.sequenceNumber,
      prevHash,
      hash,
      volatility: toCommittedVolatility(base.volatility),
    };

    if (this._mode === "SilentMode") {
      committed.isReplay = true;
    }

    Object.freeze(committed);

    const len = this.processors.length;
    for (let i = 0; i < len; i++) {
      this.processors[i]!.incomingQueue.push(committed);
    }
  }
}
