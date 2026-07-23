import type { IAttributionStore } from "@auction/marketing-events";
import type { MarketingAttributionSnapshot } from "@auction/types";

export class CachedAttributionStore implements IAttributionStore {
  constructor(
    private readonly primary: IAttributionStore,
    private readonly cache: IAttributionStore,
  ) {}

  async put(userId: string, snapshot: MarketingAttributionSnapshot): Promise<void> {
    await this.primary.put(userId, snapshot);
    const merged = await this.primary.get(userId);
    if (merged) {
      await this.cache.put(userId, merged).catch(() => undefined);
    } else {
      await this.cache.delete(userId).catch(() => undefined);
    }
  }

  async get(userId: string): Promise<MarketingAttributionSnapshot | null> {
    const cached = await this.cache.get(userId).catch(() => null);
    if (cached) return cached;
    return this.primary.get(userId);
  }

  async delete(userId: string): Promise<void> {
    await this.primary.delete(userId);
    // Propagate cache deletion failures so consent-withdrawal callers retry.
    await this.cache.delete(userId);
  }
}
