/**
 * AsyncIterable queue for fire-and-forget Hub broadcast.
 * Implements EventQueue; processors consume via async iteration.
 */

import type { CommitedEvent } from "./event-contracts.js";
import type { EventQueue } from "../interfaces/event-queue.js";

type EnqueuedEvent = CommitedEvent & { isReplay?: boolean };

export class AsyncEventQueue implements EventQueue {
  private readonly buffer: EnqueuedEvent[] = [];
  private resolveNext: (() => void) | null = null;
  private done = false;

  push(event: EnqueuedEvent): void {
    this.buffer.push(event);
    const r = this.resolveNext;
    if (r) {
      this.resolveNext = null;
      r();
    }
  }

  close(): void {
    this.done = true;
    const r = this.resolveNext;
    if (r) {
      this.resolveNext = null;
      r();
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<EnqueuedEvent> {
    for (;;) {
      if (this.buffer.length > 0) {
        const item = this.buffer.shift()!;
        yield item;
        continue;
      }
      if (this.done) return;
      await new Promise<void>((r) => {
        this.resolveNext = r;
      });
    }
  }
}
