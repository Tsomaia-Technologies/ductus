/**
 * MemoryCacheAdapter - in-memory KV cache for Verifiable Caching.
 * RFC-001 Task 015-agent-processor.
 */

import type { CacheAdapter } from "../interfaces/cache-adapter.js";

export class MemoryCacheAdapter implements CacheAdapter {
  private readonly store = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.store.set(key, value);
  }
}
