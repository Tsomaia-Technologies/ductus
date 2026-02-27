/**
 * AsyncIterable queue for fire-and-forget Hub broadcast.
 * Implements EventQueue; processors consume via async iteration.
 * Implements an O(1) Ring Buffer to avoid costly `.shift()` re-allocations.
 */

import type { CommittedEvent } from "../interfaces/event.js";
import type { EventQueue } from "../interfaces/event-queue.js";

type EnqueuedEvent = CommittedEvent & { isReplay?: boolean };

export class RingBufferQueue<T> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private capacity: number;

  private resolveNext: (() => void) | null = null;
  private done = false;

  constructor(initialCapacity: number = 256) {
    this.capacity = initialCapacity;
    this.buffer = new Array(this.capacity);
  }

  push(event: T): void {
    if (this.size === this.capacity) {
      this.resize();
    }

    this.buffer[this.tail] = event;
    this.tail = (this.tail + 1) % this.capacity;
    this.size++;

    const r = this.resolveNext;
    if (r) {
      this.resolveNext = null;
      r();
    }
  }

  private resize(): void {
    const newCapacity = this.capacity * 2;
    const newBuffer = new Array(newCapacity);

    for (let i = 0; i < this.size; i++) {
      newBuffer[i] = this.buffer[(this.head + i) % this.capacity]!;
    }

    this.buffer = newBuffer;
    this.head = 0;
    this.tail = this.size;
    this.capacity = newCapacity;
  }

  close(): void {
    this.done = true;
    const r = this.resolveNext;
    if (r) {
      this.resolveNext = null;
      r();
    }
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<T> {
    for (; ;) {
      if (this.size > 0) {
        const item = this.buffer[this.head]!;
        // Prevent memory leak by nulling out reference
        this.buffer[this.head] = undefined as any;
        this.head = (this.head + 1) % this.capacity;
        this.size--;

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

export class AsyncEventQueue extends RingBufferQueue<EnqueuedEvent> implements EventQueue { }
