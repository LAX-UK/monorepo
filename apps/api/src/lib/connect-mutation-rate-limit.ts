import type { Redis } from "ioredis";

const WINDOW_SEC = 60;
const MAX_ENSURE_PER_ENTITY = 10;
const MAX_SYNC_PER_ENTITY = 40;

export type ConnectMutationRateLimitKind = "account" | "sync";

/** Per-legal-entity limits for Connect mutations (complements IP rate limit on /stripe-connect/*). */
export async function checkConnectMutationRateLimit(
  redis: Redis,
  kind: ConnectMutationRateLimitKind,
  legalEntityId: string,
): Promise<boolean> {
  const max = kind === "account" ? MAX_ENSURE_PER_ENTITY : MAX_SYNC_PER_ENTITY;
  const key = `rl:connect:${kind}:${legalEntityId}`;
  const n = await redis.incr(key);
  if (n === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  return n <= max;
}
