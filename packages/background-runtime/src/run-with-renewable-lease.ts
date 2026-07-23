import type { Redis } from "ioredis";
import {
  acquireRenewableLease,
  releaseRenewableLease,
  renewRenewableLease,
} from "./redis-renewable-lease.js";

export type RenewableLeaseRunOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "skipped_locked" | "lock_failed"; error?: unknown };

/** Acquire tokenized lease, renew while work runs, release if still owner. */
export async function runWithRenewableLease<T>(
  redis: Redis,
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts?: { renewIntervalMs?: number },
): Promise<RenewableLeaseRunOutcome<T>> {
  let lease: { token: string } | null;
  try {
    lease = await acquireRenewableLease(redis, key, ttlMs);
  } catch (error) {
    return { ok: false, reason: "lock_failed", error };
  }
  if (!lease) {
    return { ok: false, reason: "skipped_locked" };
  }

  const token = lease.token;
  const renewEvery = opts?.renewIntervalMs ?? Math.max(Math.floor(ttlMs / 3), 1000);
  const renewTimer = setInterval(() => {
    void renewRenewableLease(redis, key, token, ttlMs);
  }, renewEvery);

  try {
    const value = await fn();
    return { ok: true, value };
  } finally {
    clearInterval(renewTimer);
    await releaseRenewableLease(redis, key, lease.token);
  }
}
