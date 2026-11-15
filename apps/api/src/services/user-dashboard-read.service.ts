import type { Bid, Lot, PublicLotView, Sale } from "@auction/types";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { presentLotsImages } from "../lib/media-presenters.js";
import type { DashboardQueryService } from "./dashboard-query.service.js";
import type { MediaAssetEnricher } from "./media-asset-enricher.js";
import type { MediaUrlResolver } from "./media-url-resolver.js";
import type {
  WatchlistListOptions,
  WatchlistService,
  WatchlistWithLot,
} from "./watchlist.service.js";

/** A lot as the reader may see it: as stored for staff, the public view for everyone else. */
export type DashboardLot = Lot | PublicLotView;
export type UserBidWithLot = { bid: Bid; lot: DashboardLot | null };
export type UserWatchlistRow = Omit<WatchlistWithLot, "lot"> & { lot: DashboardLot | null };

/** The reader's role, which decides whether lots carry staff-only figures such as the reserve. */
export type DashboardViewerAccess = {
  role?: string | undefined;
  staffRole?: string | null | undefined;
};

type SaleLookup = { findByIds(ids: string[]): Promise<Sale[]> };

export class UserDashboardReadService {
  constructor(
    private readonly dashboardQuery: DashboardQueryService,
    private readonly watchlistService: WatchlistService,
    private readonly mediaUrlResolver: MediaUrlResolver | undefined,
    private readonly saleLookup: SaleLookup,
    private readonly mediaAssetEnricher?: MediaAssetEnricher,
  ) {}

  async listBidsForUser(userId: string, access?: DashboardViewerAccess): Promise<UserBidWithLot[]> {
    const rows = await this.dashboardQuery.listBidsWithLotsForBidder(userId);
    return this.attachEnrichedLots(rows, access);
  }

  async listWatchlistForUser(
    userId: string,
    options: WatchlistListOptions = {},
    access?: DashboardViewerAccess,
  ): Promise<UserWatchlistRow[]> {
    const rows = await this.watchlistService.listWithLots(userId, options);
    return this.attachEnrichedLots(rows, access);
  }

  private async attachEnrichedLots<T extends { lot: Lot | null }>(
    rows: T[],
    access: DashboardViewerAccess | undefined,
  ): Promise<(Omit<T, "lot"> & { lot: DashboardLot | null })[]> {
    const lots = rows.map((r) => r.lot).filter((l): l is Lot => Boolean(l));
    const enriched = await this.enrichLots(lots, access);
    const byId = new Map(enriched.map((l) => [l.id, l]));
    return rows.map((row) => ({
      ...row,
      lot: row.lot
        ? (byId.get(row.lot.id) ?? maskLotForPublicView(row.lot, access?.role, access?.staffRole))
        : null,
    }));
  }

  private async enrichLots(
    lots: Lot[],
    access: DashboardViewerAccess | undefined,
  ): Promise<DashboardLot[]> {
    if (lots.length === 0) return lots;
    const presented = await presentLotsImages(this.mediaUrlResolver, lots, this.mediaAssetEnricher);
    return this.withCheckoutPricing(presented, access);
  }

  private async withCheckoutPricing(
    lots: Lot[],
    access: DashboardViewerAccess | undefined,
  ): Promise<DashboardLot[]> {
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
      // Mask first, then price: no reserve amount for non-staff, and an open sealed lot's real
      // price must not leak through its checkout figures.
      const shown = maskLotForPublicView(lotRow, access?.role, access?.staffRole);
      return { ...shown, checkoutPricing: computeLotCheckoutPricing(shown, sale) };
    });
  }
}
