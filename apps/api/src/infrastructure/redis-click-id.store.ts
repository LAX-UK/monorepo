import type { IClickIdStore } from "@auction/marketing-events";
import type { ClickIds } from "@auction/types";
import type { Redis } from "ioredis";

const KEY_PREFIX = "marketing:click_ids:";
const TTL_SEC = 60 * 60 * 24 * 90;

export class RedisClickIdStore implements IClickIdStore {
  constructor(private readonly redis: Redis) {}

  private key(userId: string): string {
    return `${KEY_PREFIX}${userId}`;
  }

  async put(userId: string, ids: ClickIds): Promise<void> {
    const payload = JSON.stringify(ids);
    await this.redis.set(this.key(userId), payload, "EX", TTL_SEC);
  }

  async get(userId: string): Promise<ClickIds | null> {
    const raw = await this.redis.get(this.key(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ClickIds;
    } catch {
      return null;
    }
  }
}
