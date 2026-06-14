import type { Redis } from "ioredis";

const WINDOW_SEC = 60;
const MAX_ASSIGN_PER_CLERK = 60;

/** Per-clerk limit for paddle assignment mutations (~60/min). */
export async function checkPaddleAssignRateLimit(
  redis: Redis,
  clerkUserId: string,
): Promise<boolean> {
  const key = `rl:paddle-assign:${clerkUserId}`;
  const n = await redis.incr(key);
  if (n === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  return n <= MAX_ASSIGN_PER_CLERK;
}
