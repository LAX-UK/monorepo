import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";
import type { Container } from "../container.js";
import type { Env } from "../env.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";
import { createRequireAuth } from "./require-auth.js";
import { requireBuyerRole } from "./require-buyer-role.js";
import { createRequireKyc } from "./require-kyc.js";

export const BID_RL_MINUTE_MAX = 30;
export const BID_RL_HOUR_MAX = 100;

/** Per-user bid rate limits (SE-P23): 30/min and 100/hour; 429 + Retry-After. */
export function createBidUserRateLimitMiddleware(redis: Redis) {
  return createMiddleware(async (c, next) => {
    const userId = c.get("userId");
    if (!userId || typeof userId !== "string") {
      await next();
      return;
    }
    const minKey = `bid:rl:1m:${userId}`;
    const hourKey = `bid:rl:1h:${userId}`;

    const nMin = await redis.incr(minKey);
    if (nMin === 1) {
      await redis.expire(minKey, 60);
    }
    if (nMin > BID_RL_MINUTE_MAX) {
      const ms = await redis.pttl(minKey);
      const sec = Math.max(1, Math.ceil(ms / 1000));
      c.header("Retry-After", String(sec));
      return c.json({ error: "Too many bids", code: "bid_rate_limited_minute" }, 429);
    }

    const nHr = await redis.incr(hourKey);
    if (nHr === 1) {
      await redis.expire(hourKey, 3600);
    }
    if (nHr > BID_RL_HOUR_MAX) {
      const ms = await redis.pttl(hourKey);
      const sec = Math.max(1, Math.ceil(ms / 1000));
      c.header("Retry-After", String(sec));
      return c.json({ error: "Too many bids", code: "bid_rate_limited_hour" }, 429);
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

export type BuyerParticipationMiddlewareFactoryInput = {
  env: Env | undefined;
  redis: Redis;
  kycService: Container["kycService"];
  userSuspensionChecker: Container["userSuspensionChecker"];
  authenticator: IAuthenticator;
  requireSubmissionsLegalEntityContext: MiddlewareHandler<{
    Variables: BuyerParticipationVariables;
  }>;
};

export function createBuyerParticipationMiddleware(
  input: BuyerParticipationMiddlewareFactoryInput,
) {
  const requireAuth = createRequireAuth(input.authenticator, {
    isSuspended: (id) => input.userSuspensionChecker.isSuspended(id),
  });
  const strictBidEligibilityEnabled =
    input.env?.STRICT_BID_ELIGIBILITY_ENABLED ??
    (input.env?.APP_ENV != null && input.env.APP_ENV !== "production");
  const kycGate = createOptionalKycGate(input.kycService, strictBidEligibilityEnabled);
  const biddingKillSwitch = createBiddingKillSwitchMiddleware(input.env);
  const bidUserRateLimit = createBidUserRateLimitMiddleware(input.redis);
  const requireLegalEntity = input.requireSubmissionsLegalEntityContext;

  return {
    requireAuth,
    requireBuyerRole,
    kycGate,
    biddingKillSwitch,
    bidUserRateLimit,
    requireLegalEntity,
  };
}
