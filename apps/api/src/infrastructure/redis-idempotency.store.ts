import type { Redis } from "ioredis";
import type { IIdempotencyStore } from "../services/interfaces/idempotency-store.js";

export class RedisIdempotencyStore implements IIdempotencyStore {
  constructor(private readonly redis: Redis) {}

  get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
    await this.redis.set(key, value, "EX", ttlSeconds);
  }
}
