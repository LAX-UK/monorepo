import type { ICooldownStore } from "../services/interfaces/organisation-security-service.js";

/** The one Redis command this store needs. */
type RedisSetNx = {
  set(key: string, value: string, mode: "EX", ttlSeconds: number, nx: "NX"): Promise<unknown>;
};

/** `SET key 1 EX ttl NX`: the first claim wins until the key expires. */
export class RedisCooldownStore implements ICooldownStore {
  constructor(
    private readonly redis: RedisSetNx,
    private readonly prefix = "cooldown:",
  ) {}

  async claim(key: string, ttlSeconds: number): Promise<boolean> {
    const result = await this.redis.set(`${this.prefix}${key}`, "1", "EX", ttlSeconds, "NX");
    return result === "OK";
  }
}
