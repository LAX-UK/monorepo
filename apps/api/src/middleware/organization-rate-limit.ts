import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";

const WINDOW_SEC = 3600;
const MAX_CREATES_PER_USER = 5;

/** Rate-limit `POST /organizations` — per authenticated user. */
export function createOrganizationCreateRateLimitMiddleware(redis: Redis) {
  return createMiddleware<{ Variables: { userId?: string } }>(async (c, next) => {
    const userId = c.get("userId");
    if (!userId) {
      await next();
      return;
    }
    const key = `org-create:${userId}`;
    const n = await redis.incr(key);
    if (n === 1) {
      await redis.expire(key, WINDOW_SEC);
    }
    if (n > MAX_CREATES_PER_USER) {
      return c.json({ error: "rate_limit_exceeded" }, 429);
    }
    await next();
  });
}
