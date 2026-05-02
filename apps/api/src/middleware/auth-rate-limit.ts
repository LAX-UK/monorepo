import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";

const GENERAL_WINDOW_SEC = 60;
const MAX_AUTH_REQUESTS = 30;
const SIGN_IN_WINDOW_SEC = 15 * 60;
const MAX_SIGN_IN_REQUESTS = 5;

/** Stricter bucket for Better Auth (`/api/auth/*`) to slow brute-force attempts. */
export function createAuthRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const isSignIn = c.req.path.includes("/sign-in");
    const key = isSignIn ? `rl:auth:signin:${ip}` : `rl:auth:${ip}`;
    const windowSec = isSignIn ? SIGN_IN_WINDOW_SEC : GENERAL_WINDOW_SEC;
    const maxRequests = isSignIn ? MAX_SIGN_IN_REQUESTS : MAX_AUTH_REQUESTS;
    const n = await redis.incr(key);
    if (n === 1) {
      await redis.expire(key, windowSec);
    }
    if (n > maxRequests) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
