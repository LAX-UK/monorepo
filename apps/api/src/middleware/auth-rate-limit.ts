import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";
import { extractBetterAuthSessionToken } from "../lib/session-cookie.js";

/** Central auth rate-limit policy (sliding window, Redis sorted sets). */
export const RATE_LIMIT_CONFIG = {
  authGeneralWindowSec: 60,
  authGeneralMax: 30,
  signInWindowSec: 15 * 60,
  signInMax: 5,
  forgotIpWindowSec: 60,
  forgotIpMax: 5,
  forgotEmailWindowSec: 60 * 60,
  forgotEmailMax: 3,
  setupPasswordWindowSec: 60,
  setupPasswordMax: 3,
  totpWindowSec: 15 * 60,
  totpMax: 5,
  totpLockoutSec: 30 * 60,
  confirmEmailChangeWindowSec: 60,
  confirmEmailChangeMax: 10,
  magicLinkIpWindowSec: 60,
  magicLinkIpMax: 5,
  magicLinkEmailWindowSec: 60 * 60,
  magicLinkEmailMax: 3,
} as const;

async function slidingIncrement(redis: Redis, key: string, windowSec: number): Promise<number> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const minScore = now - windowMs;
  const member = `${now}:${randomUUID()}`;
  const pipeline = redis.multi();
  pipeline.zadd(key, now, member);
  pipeline.zremrangebyscore(key, 0, minScore);
  pipeline.expire(key, windowSec);
  pipeline.zcard(key);
  const results = await pipeline.exec();
  const card = results?.[3]?.[1];
  return typeof card === "number" ? card : Number(card ?? 0);
}

/** Stricter bucket for Better Auth (`/api/auth/*`) — sliding window per IP. */
export function createAuthRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const path = c.req.path;
    const isTotp = path.includes("two-factor");
    const isSignIn = path.includes("/sign-in");
    if (isTotp) {
      const lockKey = `rl:auth:totp-lock:${ip}`;
      const locked = await redis.get(lockKey);
      if (locked) {
        return c.json({ error: "Too many requests" }, 429);
      }
      const key = `rl:auth:totp:${ip}`;
      const n = await slidingIncrement(redis, key, RATE_LIMIT_CONFIG.totpWindowSec);
      if (n > RATE_LIMIT_CONFIG.totpMax) {
        await redis.set(lockKey, "1", "EX", RATE_LIMIT_CONFIG.totpLockoutSec);
        return c.json({ error: "Too many requests" }, 429);
      }
      await next();
      return;
    }
    const key = isSignIn ? `rl:auth:signin:${ip}` : `rl:auth:${ip}`;
    const windowSec = isSignIn
      ? RATE_LIMIT_CONFIG.signInWindowSec
      : RATE_LIMIT_CONFIG.authGeneralWindowSec;
    const maxRequests = isSignIn ? RATE_LIMIT_CONFIG.signInMax : RATE_LIMIT_CONFIG.authGeneralMax;
    const n = await slidingIncrement(redis, key, windowSec);
    if (n > maxRequests) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}

/** Rate-limit the Hono `/auth/forgot-password` route. */
export function createForgotPasswordRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const ipKey = `rl:auth:forgot-ip:${ip}`;
    const ipCount = await slidingIncrement(redis, ipKey, RATE_LIMIT_CONFIG.forgotIpWindowSec);
    if (ipCount > RATE_LIMIT_CONFIG.forgotIpMax) {
      return c.json({ error: "Too many requests" }, 429);
    }

    let body: { email?: unknown } = {};
    try {
      body = (await c.req.raw.clone().json()) as { email?: unknown };
    } catch {
      await next();
      return;
    }
    if (typeof body.email === "string") {
      const normalised = body.email.trim().toLowerCase();
      if (normalised.length > 0 && normalised.length <= 254) {
        const emailKey = `rl:auth:forgot-email:${normalised}`;
        const emailCount = await slidingIncrement(
          redis,
          emailKey,
          RATE_LIMIT_CONFIG.forgotEmailWindowSec,
        );
        if (emailCount > RATE_LIMIT_CONFIG.forgotEmailMax) {
          return c.json({ error: "Too many requests" }, 429);
        }
      }
    }
    await next();
  });
}

/** Rate-limit `POST /auth/confirm-email-change` — per IP. */
export function createConfirmEmailChangeRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `rl:auth:confirm-email-change:${ip}`;
    const n = await slidingIncrement(redis, key, RATE_LIMIT_CONFIG.confirmEmailChangeWindowSec);
    if (n > RATE_LIMIT_CONFIG.confirmEmailChangeMax) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}

/** Rate-limit `POST /api/auth/sign-in/magic-link` (Better Auth handler). */
export function createMagicLinkRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== "POST" || !c.req.path.endsWith("/sign-in/magic-link")) {
      await next();
      return;
    }

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const ipKey = `rl:auth:magic-link-ip:${ip}`;
    const ipCount = await slidingIncrement(redis, ipKey, RATE_LIMIT_CONFIG.magicLinkIpWindowSec);
    if (ipCount > RATE_LIMIT_CONFIG.magicLinkIpMax) {
      return c.json({ error: "Too many requests" }, 429);
    }

    let body: { email?: unknown } = {};
    try {
      body = (await c.req.raw.clone().json()) as { email?: unknown };
    } catch {
      await next();
      return;
    }
    if (typeof body.email === "string") {
      const normalised = body.email.trim().toLowerCase();
      if (normalised.length > 0 && normalised.length <= 254) {
        const emailKey = `rl:auth:magic-link-email:${normalised}`;
        const emailCount = await slidingIncrement(
          redis,
          emailKey,
          RATE_LIMIT_CONFIG.magicLinkEmailWindowSec,
        );
        if (emailCount > RATE_LIMIT_CONFIG.magicLinkEmailMax) {
          return c.json({ error: "Too many requests" }, 429);
        }
      }
    }
    await next();
  });
}

/** Rate-limit `/auth/setup-password`. */
export function createSetupPasswordRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    // Use the shared extractor so the `__Secure-` prefix is handled in production.
    const sessionToken = extractBetterAuthSessionToken(c.req.header("cookie"));
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const identity = sessionToken ? `s:${sessionToken.slice(0, 64)}` : `ip:${ip}`;
    const key = `rl:auth:setup-password:${identity}`;
    const n = await slidingIncrement(redis, key, RATE_LIMIT_CONFIG.setupPasswordWindowSec);
    if (n > RATE_LIMIT_CONFIG.setupPasswordMax) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
