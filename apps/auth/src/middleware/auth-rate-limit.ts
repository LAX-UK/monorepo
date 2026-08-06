import { randomUUID } from "node:crypto";
import { AUTH_RATE_LIMIT_POLICY, slidingWindowRetryAfterSec } from "@auction/auth";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";

/** Sliding-window thresholds mirroring apps/api to protect the auth issuer from distributed attacks. */
const RL = AUTH_RATE_LIMIT_POLICY;

function rateLimited(c: Context, retryAfterSec: number) {
  c.header("Retry-After", String(retryAfterSec));
  return c.json({ error: "Too many requests", code: "rate_limited", retryAfterSec }, 429);
}

async function slidingIncrement(redis: Redis, key: string, windowSec: number): Promise<number> {
  const now = Date.now();
  const minScore = now - windowSec * 1000;
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

async function emailFromJsonBody(req: Request): Promise<string | null> {
  try {
    const body = (await req.clone().json()) as { email?: unknown };
    if (typeof body.email !== "string") return null;
    const normalized = body.email.trim().toLowerCase();
    return normalized.length > 0 && normalized.length <= 254 ? normalized : null;
  } catch {
    return null;
  }
}

/** Match the API host's strict resend-verification IP and email buckets. */
export function createSendVerificationIssuerRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== "POST" || !c.req.path.endsWith("/send-verification-email")) {
      await next();
      return;
    }
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const ipCount = await slidingIncrement(
      redis,
      `rl:auth-issuer:send-verification-ip:${ip}`,
      RL.sendVerificationIpWindowSec,
    );
    if (ipCount > RL.sendVerificationIpMax) {
      return rateLimited(c, RL.sendVerificationIpWindowSec);
    }
    const email = await emailFromJsonBody(c.req.raw);
    if (email) {
      const emailCount = await slidingIncrement(
        redis,
        `rl:auth-issuer:send-verification-email:${email}`,
        RL.sendVerificationEmailWindowSec,
      );
      if (emailCount > RL.sendVerificationEmailMax) {
        return rateLimited(c, RL.sendVerificationEmailWindowSec);
      }
    }
    await next();
  });
}

/**
 * IP-based sliding-window rate limiter for the auth issuer (`/api/auth/*`).
 *
 * The main API already rate-limits its own `/api/auth/*` proxy but the auth
 * issuer can be reached directly (e.g. from mobile clients or misconfigured
 * infra).  Without its own rate limit it is vulnerable to distributed brute-
 * force that bypasses the API gateway.
 */
export function createMagicLinkIssuerRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    if (c.req.method !== "POST" || !c.req.path.endsWith("/sign-in/magic-link")) {
      await next();
      return;
    }

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const ipKey = `rl:auth-issuer:magic-link-ip:${ip}`;
    const ipCount = await slidingIncrement(redis, ipKey, RL.magicLinkIpWindowSec);
    if (ipCount > RL.magicLinkIpMax) {
      const retryAfterSec = await slidingWindowRetryAfterSec(
        redis,
        ipKey,
        RL.magicLinkIpWindowSec,
        ipCount,
        RL.magicLinkIpMax,
      );
      return rateLimited(c, retryAfterSec);
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
        const emailKey = `rl:auth-issuer:magic-link-email:${normalised}`;
        const emailCount = await slidingIncrement(redis, emailKey, RL.magicLinkEmailWindowSec);
        if (emailCount > RL.magicLinkEmailMax) {
          const retryAfterSec = await slidingWindowRetryAfterSec(
            redis,
            emailKey,
            RL.magicLinkEmailWindowSec,
            emailCount,
            RL.magicLinkEmailMax,
          );
          return rateLimited(c, retryAfterSec);
        }
      }
    }
    await next();
  });
}

export function createAuthIssuerRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown";
    const path = c.req.path;
    const isTotp = path.includes("two-factor");
    const isSignIn = path.includes("/sign-in");

    if (isTotp) {
      const lockKey = `rl:auth-issuer:totp-lock:${ip}`;
      const locked = await redis.get(lockKey);
      if (locked) {
        const ttl = await redis.ttl(lockKey);
        return rateLimited(c, ttl > 0 ? ttl : RL.totpLockoutSec);
      }
      const key = `rl:auth-issuer:totp:${ip}`;
      const n = await slidingIncrement(redis, key, RL.totpWindowSec);
      if (n > RL.totpMax) {
        await redis.set(lockKey, "1", "EX", RL.totpLockoutSec);
        return rateLimited(c, RL.totpLockoutSec);
      }
      await next();
      return;
    }

    const key = isSignIn ? `rl:auth-issuer:signin:${ip}` : `rl:auth-issuer:${ip}`;
    const windowSec = isSignIn ? RL.signInWindowSec : RL.authGeneralWindowSec;
    const max = isSignIn ? RL.signInMax : RL.authGeneralMax;
    const n = await slidingIncrement(redis, key, windowSec);
    if (n > max) {
      const retryAfterSec = await slidingWindowRetryAfterSec(redis, key, windowSec, n, max);
      return rateLimited(c, retryAfterSec);
    }
    await next();
  });
}
