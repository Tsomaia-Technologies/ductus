import type { CommittedEvent } from "./event.js";

/** Queue that the Hub pushes to. Fire-and-forget; Hub does not await. */
export interface EventQueue {
  push(event: CommittedEvent & { isReplay?: boolean }): void;
}
