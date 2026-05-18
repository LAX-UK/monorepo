import type { Database } from "@auction/db";

export type WatchlistRow = {
  id: string;
  userId: string;
  lotId: string;
  createdAt: Date;
};

export interface IWatchlistRepository {
  add(userId: string, lotId: string, conn?: Database): Promise<WatchlistRow>;
  remove(userId: string, lotId: string, conn?: Database): Promise<void>;
  findByUser(userId: string): Promise<WatchlistRow[]>;
  exists(userId: string, lotId: string): Promise<boolean>;
  listUserIdsForLot(lotId: string): Promise<string[]>;
}
