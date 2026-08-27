import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";
import type { Container } from "../container.js";
import type { Env } from "../env.js";
import { RedisLuaRateLimitStore } from "../infrastructure/redis-lua-rate-limit.store.js";
import type { IRateLimitStore } from "../services/interfaces/rate-limit-store.js";
import { createRequireKyc } from "./require-kyc.js";

export const BID_RL_MINUTE_MAX = 30;
export const BID_RL_HOUR_MAX = 100;

/**
 * Per-user bid rate limits (SE-P23): 30/min and 100/hour; 429 + Retry-After.
 * Uses the shared Lua fixed-window so INCR+EXPIRE is atomic. Redis errors fail
 * closed with 503 `bid_rate_limit_unavailable` rather than letting bids through.
 */
export function createBidUserRateLimitMiddleware(
  redis: Redis,
  store: IRateLimitStore = new RedisLuaRateLimitStore(redis),
) {
  return createMiddleware(async (c, next) => {
    const userId = c.get("userId");
    if (!userId || typeof userId !== "string") {
      await next();
      return;
    }

    try {
      const minute = await store.increment(`bid:rl:1m:${userId}`, BID_RL_MINUTE_MAX, 60);
      if (!minute.allowed) {
        c.header("Retry-After", String(minute.retryAfterSec ?? 1));
        return c.json({ error: "Too many bids", code: "bid_rate_limited_minute" }, 429);
      }

      const hour = await store.increment(`bid:rl:1h:${userId}`, BID_RL_HOUR_MAX, 3600);
      if (!hour.allowed) {
        c.header("Retry-After", String(hour.retryAfterSec ?? 1));
        return c.json({ error: "Too many bids", code: "bid_rate_limited_hour" }, 429);
      }
    } catch {
      return c.json(
        { error: "Bid rate limit is temporarily unavailable", code: "bid_rate_limit_unavailable" },
        503,
      );
    }

    await next();
  });
}

export function createBiddingKillSwitchMiddleware(env: Env | undefined) {
  return createMiddleware(async (c, next) => {
    if (env?.DISABLE_BIDDING) {
      return c.json({ error: "Bidding temporarily disabled", code: "bidding_disabled" }, 503);
    }
    await next();
  });
}

export function createOptionalKycGate(
  kyc: Container["kycService"],
  strictBidEligibilityEnabled = false,
) {
  return !strictBidEligibilityEnabled && kyc?.isConfigured() === true
    ? createRequireKyc(kyc)
    : createMiddleware<{ Variables: { userId?: string } }>(async (_c, next) => {
        await next();
      });
}

export type BuyerParticipationVariables = {
  userId?: string;
  userRole?: string;
  userStaffRole?: string | null;
  legalEntityContext?: { legalEntityId: string };
};

export type BuyerParticipationHono = Hono<{ Variables: BuyerParticipationVariables }>;

export function createBuyerParticipationHono(): BuyerParticipationHono {
  return new Hono<{ Variables: BuyerParticipationVariables }>();
}
