import type { CommitedEvent } from "../core/event-contracts.js";

/** Queue that the Hub pushes to. Fire-and-forget; Hub does not await. */
export interface EventQueue {
  push(event: CommitedEvent & { isReplay?: boolean }): void;
}
