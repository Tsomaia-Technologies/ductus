/**
 * Pure Reactive Stream Interface for all Processors.
 * RFC-001 Section 2.1 - Processors communicate strictly via events.
 * 
 * CRITICAL RULE: Processors MUST NOT accept the Hub in their constructors.
 * The relationship is strictly generic `AsyncIterable<Incoming> -> AsyncIterable<Outgoing>`.
 */

import type { CommittedEvent, BaseEvent } from "./event.js";

/** Input stream consumed by a processor. */
export type InputEventStream = AsyncIterable<CommittedEvent>;

/** Output stream yielded by a processor. */
export type OutputEventStream = AsyncIterable<BaseEvent>;

export interface EventProcessor {
    /**
     * Consumes incoming verified events and yields new intentional drafts.
     * Must use `for await (const event of stream)` and pure `yield`.
     */
    process(stream: InputEventStream): OutputEventStream;
}
