import type { Bid, Lot, Sale } from "@auction/types";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { maskSealedLotPriceForViewer } from "../lib/lot-public-view.js";
import { presentLotsImages } from "../lib/media-presenters.js";
import type { DashboardQueryService } from "./dashboard-query.service.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type {
  WatchlistListOptions,
  WatchlistService,
  WatchlistWithLot,
} from "./watchlist.service.js";

export type UserBidWithLot = { bid: Bid; lot: Lot | null };
export type UserWatchlistRow = WatchlistWithLot & { lot: Lot | null };

type SaleLookup = { findByIds(ids: string[]): Promise<Sale[]> };

/** Viewer identity used to hide sealed high bids from non-staff. */
export type DashboardViewer = { role?: string | undefined; staffRole?: string | null | undefined };

export class UserDashboardReadService {
  constructor(
    private readonly dashboardQuery: DashboardQueryService,
    private readonly watchlistService: WatchlistService,
    private readonly mediaUrlResolver: MediaUrlResolver | undefined,
    private readonly saleLookup: SaleLookup,
    private readonly mediaAssetEnricher?: MediaAssetEnricher,
  ) {}

  async listBidsForUser(userId: string, viewer?: DashboardViewer): Promise<UserBidWithLot[]> {
    const rows = await this.dashboardQuery.listBidsWithLotsForBidder(userId);
    return this.attachEnrichedLots(rows, viewer);
  }

  async listWatchlistForUser(
    userId: string,
    options: WatchlistListOptions = {},
    viewer?: DashboardViewer,
  ): Promise<UserWatchlistRow[]> {
    const rows = await this.watchlistService.listWithLots(userId, options);
    return this.attachEnrichedLots(rows, viewer);
  }

  private async attachEnrichedLots<T extends { lot: Lot | null }>(
    rows: T[],
    viewer?: DashboardViewer,
  ): Promise<(T & { lot: Lot | null })[]> {
    const lots = rows.map((r) => r.lot).filter((l): l is Lot => Boolean(l));
    const enriched = await this.enrichLots(lots, viewer);
    const byId = new Map(enriched.map((l) => [l.id, l]));
    return rows.map((row) => ({
      ...row,
      lot: row.lot ? (byId.get(row.lot.id) ?? row.lot) : null,
    }));
  }

  private async enrichLots(lots: Lot[], viewer?: DashboardViewer): Promise<Lot[]> {
    if (lots.length === 0) return lots;
    const presented = await presentLotsImages(this.mediaUrlResolver, lots, this.mediaAssetEnricher);
    // Mask before pricing so no checkout figure is derived from a hidden sealed high bid.
    const masked = presented.map((lot) =>
      maskSealedLotPriceForViewer(lot, viewer?.role, viewer?.staffRole),
    );
    return this.withCheckoutPricing(masked);
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
