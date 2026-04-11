import type { Auction } from "@auction/types";
import type { IAuctionRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository, WatchlistRow } from "./interfaces/watchlist.js";

export type WatchlistWithAuction = {
  watchlistId: string;
  auctionId: string;
  createdAt: Date;
  auction: Auction | null;
};

export class WatchlistService {
  constructor(
    private readonly watchlist: IWatchlistRepository,
    private readonly auctions: IAuctionRepository,
  ) {}

  async add(userId: string, auctionId: string): Promise<WatchlistRow | null> {
    const auction = await this.auctions.findById(auctionId);
    if (!auction) return null;
    return this.watchlist.add(userId, auctionId);
  }

  remove(userId: string, auctionId: string): Promise<void> {
    return this.watchlist.remove(userId, auctionId);
  }

  list(userId: string): Promise<WatchlistRow[]> {
    return this.watchlist.findByUser(userId);
  }

  exists(userId: string, auctionId: string): Promise<boolean> {
    return this.watchlist.exists(userId, auctionId);
  }

  async listWithAuctions(userId: string): Promise<WatchlistWithAuction[]> {
    const rows = await this.watchlist.findByUser(userId);
    const out: WatchlistWithAuction[] = [];
    for (const r of rows) {
      const auction = await this.auctions.findById(r.auctionId);
      out.push({
        watchlistId: r.id,
        auctionId: r.auctionId,
        createdAt: r.createdAt,
        auction,
      });
    }
    return out;
  }
}
