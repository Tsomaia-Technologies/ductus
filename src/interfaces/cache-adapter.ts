import { Json } from './json.js'

export interface CacheAdapter {
  has(key: string): Promise<boolean>
  get(key: string): Promise<Json | null>
  getOrFresh(
    key: string,
    getFresh: () => Promise<Json>,
    ttlSecond?: number,
  ): Promise<Json>
  set(key: string, value: Json, ttlSecond?: number): Promise<void>
  invalidate(key: string): Promise<boolean>
  clear(): Promise<void>
  hash(content: Json | Buffer): Promise<string>
}
