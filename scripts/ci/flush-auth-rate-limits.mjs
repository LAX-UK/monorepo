#!/usr/bin/env node
/**
 * Clears auth sliding-window keys so sequential Playwright storage-state
 * logins do not trip signInMax (5 / 15 min / IP).
 */
import Redis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
const redis = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: false });

try {
  const keys = await redis.keys("rl:auth*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  process.stdout.write(`flushed ${keys.length} auth rate-limit key(s)\n`);
} finally {
  redis.disconnect();
}
