#!/usr/bin/env node
/**
 * Clears isolated test Redis rate-limit keys (`rl:*`).
 * Auth mint hits `/users/me` enough to trip the API 120/min path bucket
 * (`rl:<ip>:/users/me`) if only `rl:auth*` is flushed.
 */
import Redis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const redis = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: false });

try {
  const keys = await redis.keys("rl:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  process.stdout.write(`flushed ${keys.length} rate-limit key(s)\n`);
} finally {
  redis.disconnect();
}
