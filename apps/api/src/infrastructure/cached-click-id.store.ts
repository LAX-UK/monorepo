import type { IClickIdStore } from "@auction/marketing-events";
import type { ClickIds } from "@auction/types";

/** Write-through cache: Postgres is durable, Redis is the hot read path. */
export class CachedClickIdStore implements IClickIdStore {
  constructor(
    private readonly primary: IClickIdStore,
    private readonly cache: IClickIdStore,
  ) {}

  async put(userId: string, ids: ClickIds): Promise<void> {
    await this.primary.put(userId, ids);
    await this.cache.put(userId, ids);
  }

  async get(userId: string): Promise<ClickIds | null> {
    const cached = await this.cache.get(userId);
    if (cached) return cached;
    const fromDb = await this.primary.get(userId);
    if (fromDb) {
      await this.cache.put(userId, fromDb).catch(() => undefined);
    }
    return fromDb;
  }
}
