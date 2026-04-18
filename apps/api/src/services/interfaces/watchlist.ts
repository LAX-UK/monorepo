export type WatchlistRow = {
  id: string;
  userId: string;
  lotId: string;
  createdAt: Date;
};

export interface IWatchlistRepository {
  add(userId: string, lotId: string): Promise<WatchlistRow>;
  remove(userId: string, lotId: string): Promise<void>;
  findByUser(userId: string): Promise<WatchlistRow[]>;
  exists(userId: string, lotId: string): Promise<boolean>;
  listUserIdsForLot(lotId: string): Promise<string[]>;
}
