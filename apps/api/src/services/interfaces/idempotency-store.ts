/** Placeholder written by {@link IIdempotencyStore.tryClaim} while a bid is in flight. */
export const IDEMPOTENCY_PENDING_VALUE = "__pending__";

/** Minimal key-value store for short-lived idempotent HTTP replay (e.g. bids). */
export interface IIdempotencyStore {
  get(key: string): Promise<string | null>;
  /** Persist value with TTL; implementation may use SET EX or equivalent. */
  setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Acquire an in-flight slot (SET NX). Returns true when this caller owns the key. */
  tryClaim(key: string, ttlSeconds: number): Promise<boolean>;
  /** Release a pending claim after a failed placement so the client can retry. */
  delete(key: string): Promise<void>;
}
