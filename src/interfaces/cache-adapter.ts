/**
 * CacheAdapter - async Key-Value cache for Verifiable Caching (zero-cost replay).
 * RFC-001 Task 015-agent-processor, Section 4.3.
 */

export interface CacheAdapter {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}
