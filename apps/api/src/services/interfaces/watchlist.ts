export type WatchlistRow = {
  id: string;
  userId: string;
  auctionId: string;
  createdAt: Date;
};

export interface IWatchlistRepository {
  add(userId: string, auctionId: string): Promise<WatchlistRow>;
  remove(userId: string, auctionId: string): Promise<void>;
  findByUser(userId: string): Promise<WatchlistRow[]>;
  exists(userId: string, auctionId: string): Promise<boolean>;
}
