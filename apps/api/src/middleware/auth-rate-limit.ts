import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";

const WINDOW_SEC = 60;
const MAX_AUTH_REQUESTS = 30;

/** Stricter bucket for Better Auth (`/api/auth/*`) to slow brute-force attempts. */
export function createAuthRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `rl:auth:${ip}`;
    const n = await redis.incr(key);
    if (n === 1) {
      await redis.expire(key, WINDOW_SEC);
    }
    if (n > MAX_AUTH_REQUESTS) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
