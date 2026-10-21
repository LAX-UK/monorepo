import type { Redis } from "ioredis";
import type { FixedWindowCounter } from "../application/ports/fixed-window-counter.js";

const KEY_PREFIX = "shop-api:rate:";

/**
 * Redis fixed window: `SET NX EX` starts the window on the first hit and `INCR` keeps the
 * expiry, so every instance shares one count. One MULTI keeps it to a single round trip.
 */
export function createRedisFixedWindowCounter(redis: Redis): FixedWindowCounter {
  return {
    async increment(key, windowSeconds) {
      const redisKey = `${KEY_PREFIX}${key}`;
      const results = await redis
        .multi()
        .set(redisKey, 0, "EX", windowSeconds, "NX")
        .incr(redisKey)
        .ttl(redisKey)
        .exec();
      if (!results) throw new Error("rate-limit transaction aborted");
      for (const [error] of results) {
        if (error) throw error;
      }
      const count = Number(results[1]?.[1]);
      const ttl = Number(results[2]?.[1]);
      return { count, resetInSeconds: ttl > 0 ? ttl : windowSeconds };
    },
  };
}
