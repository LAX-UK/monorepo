import type { IAttributionStore } from "@auction/marketing-events";
import type { MarketingAttributionSnapshot } from "@auction/types";
import { parseMarketingAttributionSnapshot } from "@auction/validators";
import type { Redis } from "ioredis";

const KEY_PREFIX = "marketing:attribution:";
const TTL_SEC = 60 * 60 * 24 * 90;

export class RedisAttributionStore implements IAttributionStore {
  constructor(private readonly redis: Redis) {}

  private key(userId: string): string {
    return `${KEY_PREFIX}${userId}`;
  }

  async put(userId: string, snapshot: MarketingAttributionSnapshot): Promise<void> {
    await this.redis.set(this.key(userId), JSON.stringify(snapshot), "EX", TTL_SEC);
  }

  async get(userId: string): Promise<MarketingAttributionSnapshot | null> {
    const raw = await this.redis.get(this.key(userId));
    if (!raw) return null;
    try {
      const parsed = parseMarketingAttributionSnapshot(JSON.parse(raw));
      return parsed;
    } catch {
      return null;
    }
  }

  async delete(userId: string): Promise<void> {
    await this.redis.del(this.key(userId));
  }
}
