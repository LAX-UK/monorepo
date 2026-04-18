import type { Lot } from "@auction/types";
import type { ILotRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository, WatchlistRow } from "./interfaces/watchlist.js";

export type WatchlistWithLot = {
  watchlistId: string;
  lotId: string;
  createdAt: Date;
  lot: Lot | null;
};

export class WatchlistService {
  constructor(
    private readonly watchlist: IWatchlistRepository,
    private readonly lots: ILotRepository,
  ) {}

  async add(userId: string, lotId: string): Promise<WatchlistRow | null> {
    const lot = await this.lots.findById(lotId);
    if (!lot) return null;
    return this.watchlist.add(userId, lotId);
  }

  remove(userId: string, lotId: string): Promise<void> {
    return this.watchlist.remove(userId, lotId);
  }

  list(userId: string): Promise<WatchlistRow[]> {
    return this.watchlist.findByUser(userId);
  }

  exists(userId: string, lotId: string): Promise<boolean> {
    return this.watchlist.exists(userId, lotId);
  }

  async listWithLots(userId: string): Promise<WatchlistWithLot[]> {
    const rows = await this.watchlist.findByUser(userId);
    const out: WatchlistWithLot[] = [];
    for (const r of rows) {
      const lot = await this.lots.findById(r.lotId);
      out.push({
        watchlistId: r.id,
        lotId: r.lotId,
        createdAt: r.createdAt,
        lot,
      });
    }
    return out;
  }
}
