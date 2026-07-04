import type { DbTransaction, ITransactionRunner } from "@auction/persistence/interfaces";
import type { ILotRepository } from "@auction/persistence/interfaces";
import type { IWatchlistRepository, WatchlistRow } from "@auction/persistence/interfaces";
import type { MarketingEvent } from "@auction/types";
import type { Lot } from "@auction/types";
import type { IMarketingEventService } from "./interfaces/marketing-event-service.js";

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
  limit?: number;
  offset?: number;
};

export class WatchlistService {
  constructor(
    private readonly watchlist: IWatchlistRepository,
    private readonly lots: ILotRepository,
    private readonly transactionRunner: ITransactionRunner,
    private readonly marketingEvents: IMarketingEventService,
  ) {}

  async addWithMarketingEvent(
    userId: string,
    lotId: string,
    event: MarketingEvent,
  ): Promise<WatchlistRow> {
    return this.transactionRunner.runInTransaction(async (tx) => {
      const added = await this.add(userId, lotId, tx);
      if (!added) throw new Error("watchlist_insert_failed");
      await this.marketingEvents.stage(event, tx);
      return added;
    });
  }

  async removeWithMarketingEvent(
    userId: string,
    lotId: string,
    event: MarketingEvent,
  ): Promise<void> {
    await this.transactionRunner.runInTransaction(async (tx) => {
      await this.remove(userId, lotId, tx);
      await this.marketingEvents.stage(event, tx);
    });
  }

  async add(userId: string, lotId: string, conn?: DbTransaction): Promise<WatchlistRow | null> {
    const lot = await this.lots.findById(lotId);
    if (!lot) return null;
    return this.watchlist.add(userId, lotId, conn);
  }

  remove(userId: string, lotId: string, conn?: DbTransaction): Promise<void> {
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
    const rows =
      options.limit !== undefined
        ? (
            await this.watchlist.listPage({
              userId,
              limit: options.limit,
              offset: options.offset ?? 0,
              ...(options.sort !== undefined ? { sort: options.sort } : {}),
            })
          ).rows
        : await this.watchlist.findByUser(userId);
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
