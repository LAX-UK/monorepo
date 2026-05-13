/** Minimal key-value store for short-lived idempotent HTTP replay (e.g. bids). */
export interface IIdempotencyStore {
  get(key: string): Promise<string | null>;
  /** Persist value with TTL; implementation may use SET EX or equivalent. */
  setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void>;
}
