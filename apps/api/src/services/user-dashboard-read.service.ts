import type { Bid, Lot, Sale } from "@auction/types";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { presentLotsImages } from "../lib/media-presenters.js";
import type { DashboardQueryService } from "./dashboard-query.service.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type {
  WatchlistListOptions,
  WatchlistService,
  WatchlistWithLot,
} from "./watchlist.service.js";

export type UserBidWithLot = { bid: Bid; lot: Lot | null };
export type UserWatchlistRow = WatchlistWithLot & { lot: Lot | null };

type SaleLookup = { findByIds(ids: string[]): Promise<Sale[]> };

export class UserDashboardReadService {
  constructor(
    private readonly dashboardQuery: DashboardQueryService,
    private readonly watchlistService: WatchlistService,
    private readonly mediaUrlResolver: MediaUrlResolver | undefined,
    private readonly saleLookup: SaleLookup,
  ) {}

  async listBidsForUser(userId: string): Promise<UserBidWithLot[]> {
    const rows = await this.dashboardQuery.listBidsWithLotsForBidder(userId);
    return this.attachEnrichedLots(rows);
  }

  async listWatchlistForUser(
    userId: string,
    options: WatchlistListOptions = {},
  ): Promise<UserWatchlistRow[]> {
    const rows = await this.watchlistService.listWithLots(userId, options);
    return this.attachEnrichedLots(rows);
  }

  private async attachEnrichedLots<T extends { lot: Lot | null }>(
    rows: T[],
  ): Promise<(T & { lot: Lot | null })[]> {
    const lots = rows.map((r) => r.lot).filter((l): l is Lot => Boolean(l));
    const enriched = await this.enrichLots(lots);
    const byId = new Map(enriched.map((l) => [l.id, l]));
    return rows.map((row) => ({
      ...row,
      lot: row.lot ? (byId.get(row.lot.id) ?? row.lot) : null,
    }));
  }

  private async enrichLots(lots: Lot[]): Promise<Lot[]> {
    if (lots.length === 0) return lots;
    const presented = await presentLotsImages(this.mediaUrlResolver, lots);
    return this.withCheckoutPricing(presented);
  }

  private async withCheckoutPricing(lots: Lot[]): Promise<Lot[]> {
    const saleIds = [
      ...new Set(
        lots
          .map((l) => l.saleId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const saleRows = await this.saleLookup.findByIds(saleIds);
    const saleById = new Map<string, Sale>(saleRows.map((s) => [s.id, s]));
    return lots.map((lotRow) => {
      const sale = lotRow.saleId ? (saleById.get(lotRow.saleId) ?? null) : null;
      return { ...lotRow, checkoutPricing: computeLotCheckoutPricing(lotRow, sale) };
    });
  }
}
