import { createHash } from "node:crypto";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";
import { RATE_LIMIT_CONFIG } from "./auth-rate-limit.js";

async function slidingIncrement(redis: Redis, key: string, windowSec: number): Promise<number> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const minScore = now - windowMs;
  const member = `${now}:${Math.random().toString(36).slice(2)}`;
  const pipeline = redis.multi();
  pipeline.zadd(key, now, member);
  pipeline.zremrangebyscore(key, 0, minScore);
  pipeline.expire(key, windowSec);
  pipeline.zcard(key);
  const results = await pipeline.exec();
  const card = results?.[3]?.[1];
  return typeof card === "number" ? card : Number(card ?? 0);
}

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "unknown"
  );
}

function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

/** Tighter limits for public onsite-event lookup (enumeration) and RSVP submit. */
export function createOnsiteEventLookupRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip = clientIp(c);
    const ipKey = `rl:onsite:lookup:ip:${ip}`;
    const ipCount = await slidingIncrement(redis, ipKey, 60);
    if (ipCount > 15) {
      return c.json({ error: "Too many requests", code: "rate_limited" }, 429);
    }
    await next();
  });
}

/** Per-email lookup bucket — call from route after body validation. */
export async function checkOnsiteEventLookupEmailLimit(
  redis: Redis,
  email: string,
): Promise<boolean> {
  const key = `rl:onsite:lookup:email:${emailHash(email)}`;
  const n = await slidingIncrement(redis, key, 15 * 60);
  return n <= 8;
}

export function createOnsiteEventRsvpRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const ip = clientIp(c);
    const ipKey = `rl:onsite:rsvp:ip:${ip}`;
    const ipCount = await slidingIncrement(redis, ipKey, 60);
    if (ipCount > RATE_LIMIT_CONFIG.setupPasswordMax) {
      return c.json({ error: "Too many requests", code: "rate_limited" }, 429);
    }
    await next();
  });
}

export function createOnsiteEventResendRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const staffId = c.get("userId") ?? clientIp(c);
    const key = `rl:onsite:resend:${staffId}`;
    const n = await slidingIncrement(redis, key, 60);
    if (n > 20) {
      return c.json({ error: "Too many resend requests", code: "rate_limited" }, 429);
    }
    await next();
  });
}
