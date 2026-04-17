import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";

const WINDOW_SEC = 60;
const MAX_REQUESTS = 120;

export function createRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `rl:${ip}:${c.req.path}`;
    const n = await redis.incr(key);
    if (n === 1) {
      await redis.expire(key, WINDOW_SEC);
    }
    if (n > MAX_REQUESTS) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
