export type VolatilityDraft = "durable-draft" | "volatile-draft";
export type Volatility = "durable" | "volatile";

/**
 * BaseEvent: An intentional action or occurrence waiting to be stamped.
 * Pre-Hub state.
 */
export interface BaseEvent<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  authorId: string;
  timestamp: number;
  volatility: VolatilityDraft;
}

/**
 * CommittedEvent: An immutable historical fact after Hub processing.
 * Post-Hub state. Includes cryptographic ledger properties.
 */
export interface CommittedEvent<T extends string = string, P = unknown>
  extends Omit<BaseEvent<T, P>, "volatility"> {
  eventId: string;
  sequenceNumber: number;
  prevHash: string;
  hash: string;
  volatility: Volatility;
}

/**
 * Alias for canonical ledger event shape.
 */
export type DuctusEvent<T = unknown> = CommittedEvent<string, T>;
