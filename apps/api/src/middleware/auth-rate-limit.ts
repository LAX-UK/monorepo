import { createHash, randomUUID } from "node:crypto";
import { AUTH_RATE_LIMIT_POLICY } from "@auction/auth/contracts";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";

/** Central auth rate-limit policy (sliding window, Redis sorted sets). */
export const RATE_LIMIT_CONFIG = AUTH_RATE_LIMIT_POLICY;

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

/**
 * Rate-limit invitation creation/resend per acting admin (falls back to IP).
 * Prevents an over-eager or compromised admin from email-bombing via invites.
 */
export function createInviteRateLimitMiddleware(redis: Redis) {
  return createMiddleware<{
    Variables: { userId?: string };
  }>(async (c, next) => {
    const actorId = c.get("userId");
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const identity = actorId ? `u:${actorId}` : `ip:${ip}`;
    const key = `rl:invite:${identity}`;
    const n = await slidingIncrement(redis, key, RATE_LIMIT_CONFIG.inviteWindowSec);
    if (n > RATE_LIMIT_CONFIG.inviteMax) {
      return c.json({ error: "Too many invitations. Try again later." }, 429);
    }
    await next();
  });
}

/**
 * Rate-limit the public invitation `/preview` endpoint per IP. Tokens are 256-bit
 * (enumeration is already infeasible); this throttles probing/scraping attempts.
 */
export function createInvitePreviewRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const key = `rl:invite-preview:${ip}`;
    const n = await slidingIncrement(redis, key, RATE_LIMIT_CONFIG.invitePreviewWindowSec);
    if (n > RATE_LIMIT_CONFIG.invitePreviewMax) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}

async function emailFromJsonBody(req: Request): Promise<string | null> {
  let body: { email?: unknown } = {};
  try {
    body = (await req.clone().json()) as { email?: unknown };
  } catch {
    return null;
  }
  if (typeof body.email !== "string") return null;
  const normalised = body.email.trim().toLowerCase();
  if (normalised.length === 0 || normalised.length > 254) return null;
  return normalised;
}

/** Rate-limit `POST /users/register` — per IP and per target email. */
export function createRegisterRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== "POST") {
      await next();
      return;
    }
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const ipKey = `rl:register:ip:${ip}`;
    const ipCount = await slidingIncrement(redis, ipKey, RATE_LIMIT_CONFIG.registerIpWindowSec);
    if (ipCount > RATE_LIMIT_CONFIG.registerIpMax) {
      return c.json({ error: "Too many requests", code: "rate_limited" }, 429);
    }
    const email = await emailFromJsonBody(c.req.raw);
    if (email) {
      const emailKey = `rl:register:email:${email}`;
      const emailCount = await slidingIncrement(
        redis,
        emailKey,
        RATE_LIMIT_CONFIG.registerEmailWindowSec,
      );
      if (emailCount > RATE_LIMIT_CONFIG.registerEmailMax) {
        return c.json({ error: "Too many requests", code: "rate_limited" }, 429);
      }
    }
    await next();
  });
}

/** Rate-limit `/auth/setup-password`. */
export function createSetupPasswordRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const authorization = c.req.header("authorization");
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const identity = authorization?.startsWith("Bearer ")
      ? `b:${createHash("sha256").update(authorization.slice(7)).digest("base64url")}`
      : `ip:${ip}`;
    const key = `rl:auth:setup-password:${identity}`;
    const n = await slidingIncrement(redis, key, RATE_LIMIT_CONFIG.setupPasswordWindowSec);
    if (n > RATE_LIMIT_CONFIG.setupPasswordMax) {
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  });
}
