/**
 * Event Interface Contracts for the Immutable Ledger.
 * Pure TypeScript interfaces and Zod schemas. No I/O (fs, crypto, etc).
 * RFC-001 Rev 06 Section 4.1, Task 001-core-event-contracts.
 */

import { z } from "zod";

// --- Volatility Union (per architecture: prevents Ledger bloat from UI-only noise) ---

export const VolatilityDraftSchema = z.enum(["durable-draft", "volatile-draft"]);
export type VolatilityDraft = z.infer<typeof VolatilityDraftSchema>;

export const VolatilitySchema = z.enum(["durable", "volatile"]);
export type Volatility = z.infer<typeof VolatilitySchema>;

// --- BaseEvent: Intentional action waiting to be stamped (pre-Hub) ---

export interface BaseEvent<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  authorId: string;
  timestamp: number;
  volatility: VolatilityDraft;
}

// Generic BaseEvent schema for unknown type/payload (strict boundary parsing)
export const BaseEventUnknownSchema = z.object({
  type: z.string(),
  payload: z.unknown(),
  authorId: z.string().min(1),
  timestamp: z.number(),
  volatility: VolatilityDraftSchema,
});

// --- CommitedEvent: Immutable historical fact after Hub processing ---

export interface CommitedEvent<T extends string = string, P = unknown>
  extends Omit<BaseEvent<T, P>, "volatility"> {
  id: string;
  sequence: number;
  prevHash: string;
  hash: string;
  volatility: Volatility;
}

// --- DuctusEvent: Alias for CommitedEvent (canonical ledger shape per RFC 4.1) ---

export type DuctusEvent<T = unknown> = CommitedEvent<string, T>;

// SHA-256 hex: 64 lowercase hex chars. Zod v4: z.hash("sha256").
const Sha256HexSchema = z.hash("sha256");

export const DuctusEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  payload: z.unknown(),
  authorId: z.string().min(1),
  timestamp: z.number(),
  sequence: z.number().int().nonnegative(),
  prevHash: Sha256HexSchema,
  hash: Sha256HexSchema,
  volatility: VolatilitySchema,
}) satisfies z.ZodType<DuctusEvent>;

// --- Utility: Infer payload type from event type discriminator ---

/** Map event type strings to their payload shapes. Processors extend this. */
export interface EventTypePayloadMap {
  // Extend in processor modules, e.g.:
  // AGENT_REPORT: { files: string[] };
  // TOOL_COMPLETED: { exitCode: number; stdout: string };
}

/** Infers payload type from the event type discriminator. */
export type PayloadFor<T extends string, M extends EventTypePayloadMap = EventTypePayloadMap> =
  T extends keyof M ? M[T] : unknown;

/** Typed event extractor for discriminated unions. */
export type EventOfType<T extends string, M extends EventTypePayloadMap = EventTypePayloadMap> =
  DuctusEvent<PayloadFor<T, M>> & { type: T };
