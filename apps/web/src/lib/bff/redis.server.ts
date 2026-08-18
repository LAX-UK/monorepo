import "server-only";

import Redis from "ioredis";
import { bffConfig } from "./config.server";

const globalRedis = globalThis as typeof globalThis & { bidBffRedis?: Redis };

export function getBffRedis(): Redis {
  if (!globalRedis.bidBffRedis) {
    globalRedis.bidBffRedis = new Redis(bffConfig().redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }
  return globalRedis.bidBffRedis;
}

export async function ensureBffRedisConnected(redis = getBffRedis()): Promise<Redis> {
  if (redis.status === "wait") await redis.connect();
  return redis;
}
