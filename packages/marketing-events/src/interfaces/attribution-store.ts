import type { MarketingAttributionSnapshot } from "@auction/types";

export interface IAttributionStore {
  put(userId: string, snapshot: MarketingAttributionSnapshot): Promise<void>;
  get(userId: string): Promise<MarketingAttributionSnapshot | null>;
  delete(userId: string): Promise<void>;
}
