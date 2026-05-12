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

const FORGOT_PASSWORD_IP_WINDOW_SEC = 60;
const FORGOT_PASSWORD_IP_MAX = 5;
const FORGOT_PASSWORD_EMAIL_WINDOW_SEC = 60 * 60;
const FORGOT_PASSWORD_EMAIL_MAX = 10;

/** Rate-limit the Hono `/auth/forgot-password` route. Caps both bursts
 * (per IP) and total volume per email address per hour — the latter is
 * what stops harassment campaigns aimed at a specific inbox.
 */
export function createForgotPasswordRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const ipKey = `rl:auth:forgot-ip:${ip}`;
    const ipCount = await redis.incr(ipKey);
    if (ipCount === 1) {
      await redis.expire(ipKey, FORGOT_PASSWORD_IP_WINDOW_SEC);
    }
    if (ipCount > FORGOT_PASSWORD_IP_MAX) {
      return c.json({ error: "Too many requests" }, 429);
    }

    let body: { email?: unknown } = {};
    try {
      body = (await c.req.raw.clone().json()) as { email?: unknown };
    } catch {
      // body cannot be read; let downstream validator reject it.
      await next();
      return;
    }
    if (typeof body.email === "string") {
      const normalised = body.email.trim().toLowerCase();
      if (normalised.length > 0 && normalised.length <= 254) {
        const emailKey = `rl:auth:forgot-email:${normalised}`;
        const emailCount = await redis.incr(emailKey);
        if (emailCount === 1) {
          await redis.expire(emailKey, FORGOT_PASSWORD_EMAIL_WINDOW_SEC);
        }
        if (emailCount > FORGOT_PASSWORD_EMAIL_MAX) {
          // Same {ok:true} response shape to avoid leaking that the cap was hit
          // for a specific address (enumeration via 429 vs 200).
          return c.json({ ok: true });
        }
      }
    }
    await next();
  });
}

const SETUP_PASSWORD_WINDOW_SEC = 60;
const SETUP_PASSWORD_MAX_PER_SESSION = 3;

/** Rate-limit `/auth/setup-password`. Keyed by session cookie when present
 * (since this is an authenticated endpoint) and falls back to IP.
 */
export function createSetupPasswordRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const cookie = c.req.header("cookie") ?? "";
    const sessionToken = /better-auth\.session_token=([^;]+)/.exec(cookie)?.[1];
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const identity = sessionToken ? `s:${sessionToken.slice(0, 64)}` : `ip:${ip}`;
    const key = `rl:auth:setup-password:${identity}`;
    const n = await redis.incr(key);
    if (n === 1) {
      await redis.expire(key, SETUP_PASSWORD_WINDOW_SEC);
    }
    if (n > SETUP_PASSWORD_MAX_PER_SESSION) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
