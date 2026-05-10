import { placeBidSchema } from "@auction/validators";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Redis } from "ioredis";
import type { Container } from "../container.js";
import { asHttpStatus } from "../lib/http-status.js";
import { createRequireAuth } from "../middleware/require-auth.js";
import { requireBuyerRole } from "../middleware/require-buyer-role.js";
import { createRequireKyc } from "../middleware/require-kyc.js";
import type { IAuthenticator } from "../services/interfaces/authenticator.js";

const BID_RL_MINUTE_MAX = 30;
const BID_RL_HOUR_MAX = 100;

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

export function createBidRoutes(container: Container, authenticator: IAuthenticator) {
  const requireAuth = createRequireAuth(authenticator, {
    isSuspended: (id) => container.userSuspensionChecker.isSuspended(id),
  });
  const kycGate = container.kycService.isConfigured()
    ? createRequireKyc(container.kycService)
    : createMiddleware(async (_c, next) => {
        await next();
      });
  const bidUserRateLimit = createBidUserRateLimitMiddleware(container.redis);
  const r = new Hono<{ Variables: { userId?: string; userRole?: string } }>();

  r.post(
    "/",
    requireAuth,
    requireBuyerRole,
    kycGate,
    bidUserRateLimit,
    zValidator("json", placeBidSchema),
    async (c) => {
      const userId = c.get("userId") as string;
      const idem = c.req.header("idempotency-key") ?? c.req.header("Idempotency-Key");
      if (idem) {
        const cached = await container.redis.get(`idempotency:bid:${userId}:${idem}`);
        if (cached) {
          return c.json(JSON.parse(cached) as { data: unknown }, 201);
        }
      }
      const body = c.req.valid("json");
      const buyerEntity = await container.legalEntityRepository.ensurePersonalEntity(userId);
      const result = await container.bidService.placeBid(
        userId,
        buyerEntity.id,
        body.lotId,
        body.amount,
        body.maxAutoBidAmount,
      );
      if (result.isErr()) {
        const e = result.error;
        return c.json(
          e.code ? { error: e.message, code: e.code } : { error: e.message },
          asHttpStatus(e.status),
        );
      }
      const bid = result.value;
      const payload = { data: bid };
      if (idem) {
        await container.redis.set(
          `idempotency:bid:${userId}:${idem}`,
          JSON.stringify(payload),
          "EX",
          86_400,
        );
      }
      return c.json(payload, 201);
    },
  );

  return r;
}
