import type { Redis } from "ioredis";

const WINDOW_SEC = 60;
const MAX_ATTACH_PER_BUYER = 30;

/** Per-buyer limit for SoF document attach mutations (~30/min). */
export async function checkSofDocumentAttachRateLimit(
  redis: Redis,
  buyerUserId: string,
): Promise<boolean> {
  const key = `rl:sof-document-attach:${buyerUserId}`;
  const n = await redis.incr(key);
  if (n === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  return n <= MAX_ATTACH_PER_BUYER;
}
