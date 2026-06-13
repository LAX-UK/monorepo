import type { Redis, RedisOptions } from "ioredis";
import { Redis as RedisClient } from "ioredis";
import { connectionOptionsFromRedisUrl } from "./redis-url.js";

export type RedisRole = "cache" | "queue" | "pubsub";

export interface IRedisConnectionFactory {
  getClient(role: RedisRole): Redis;
}

function roleOptions(role: RedisRole, redisUrl: string): RedisOptions {
  const base = connectionOptionsFromRedisUrl(redisUrl);
  switch (role) {
    case "cache":
      return {
        ...base,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 2,
      };
    case "queue":
    case "pubsub":
      return {
        ...base,
        maxRetriesPerRequest: null,
      };
  }
}

/** Creates role-specific ioredis clients (tuning only — same logical DB as REDIS_URL). */
export class RedisConnectionFactory implements IRedisConnectionFactory {
  private readonly clients = new Map<RedisRole, Redis>();

  constructor(private readonly redisUrl: string) {}

  getClient(role: RedisRole): Redis {
    const existing = this.clients.get(role);
    if (existing) return existing;
    const client = new RedisClient(this.redisUrl, roleOptions(role, this.redisUrl));
    this.clients.set(role, client);
    return client;
  }
}

export function createRedisConnectionFactory(redisUrl: string): IRedisConnectionFactory {
  return new RedisConnectionFactory(redisUrl);
}
