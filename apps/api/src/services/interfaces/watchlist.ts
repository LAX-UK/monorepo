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
  listIds(userId: string): Promise<string[]>;
  findByUser(userId: string): Promise<WatchlistRow[]>;
  exists(userId: string, lotId: string): Promise<boolean>;
  listUserIdsForLot(lotId: string): Promise<string[]>;
  /** Number of users watching a lot (social-proof counts without materialising ids). */
  countForLot(lotId: string): Promise<number>;
}
