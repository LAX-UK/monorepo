import type { Database } from "@auction/db";
import type { Lot } from "@auction/types";
import type { ILotRepository } from "./interfaces/repositories.js";
import type { IWatchlistRepository, WatchlistRow } from "./interfaces/watchlist.js";

export type WatchlistWithLot = {
  watchlistId: string;
  lotId: string;
  createdAt: Date;
  lot: Lot | null;
};

export type WatchlistListOptions = {
  sort?: "addedDesc" | "endingSoon" | "priceAsc" | "priceDesc";
  status?: "active" | "scheduled" | "ended";
  categoryIds?: string[];
};

export class WatchlistService {
  constructor(
    private readonly watchlist: IWatchlistRepository,
    private readonly lots: ILotRepository,
  ) {}

  async add(userId: string, lotId: string, conn?: Database): Promise<WatchlistRow | null> {
    const lot = await this.lots.findById(lotId);
    if (!lot) return null;
    return this.watchlist.add(userId, lotId, conn);
  }

  remove(userId: string, lotId: string, conn?: Database): Promise<void> {
    return this.watchlist.remove(userId, lotId, conn);
  }

  list(userId: string): Promise<WatchlistRow[]> {
    return this.watchlist.findByUser(userId);
  }

  exists(userId: string, lotId: string): Promise<boolean> {
    return this.watchlist.exists(userId, lotId);
  }

  listIds(userId: string): Promise<string[]> {
    return this.watchlist.listIds(userId);
  }

  async listWithLots(
    userId: string,
    options: WatchlistListOptions = {},
  ): Promise<WatchlistWithLot[]> {
    const rows = await this.watchlist.findByUser(userId);
    const lotIds = [...new Set(rows.map((r) => r.lotId))];
    const lotRows = await this.lots.findByIds(lotIds);
    const lotMap = new Map(lotRows.map((l) => [l.id, l]));
    const out: WatchlistWithLot[] = rows.map((r) => ({
      watchlistId: r.id,
      lotId: r.lotId,
      createdAt: r.createdAt,
      lot: lotMap.get(r.lotId) ?? null,
    }));
    const filtered = out.filter((row) => {
      const lot = row.lot;
      if (!lot) return false;
      if (options.status && lot.status !== options.status) return false;
      if (options.categoryIds?.length) {
        const lotCategoryIds = lot.categoryIds ?? (lot.categoryId ? [lot.categoryId] : []);
        if (!lotCategoryIds.some((categoryId) => options.categoryIds?.includes(categoryId))) {
          return false;
        }
      }
      return true;
    });
    const parsePrice = (value: string) => Number.parseFloat(value) || 0;
    return filtered.sort((a, b) => {
      switch (options.sort ?? "addedDesc") {
        case "endingSoon":
          return (a.lot?.endTime.getTime() ?? 0) - (b.lot?.endTime.getTime() ?? 0);
        case "priceAsc":
          return parsePrice(a.lot?.currentPrice ?? "0") - parsePrice(b.lot?.currentPrice ?? "0");
        case "priceDesc":
          return parsePrice(b.lot?.currentPrice ?? "0") - parsePrice(a.lot?.currentPrice ?? "0");
        default:
          return b.createdAt.getTime() - a.createdAt.getTime();
      }
    });
  }
}
