import { type IBidInvoiceBatchReader, bidInvoiceKey } from "@auction/persistence/interfaces";
import type { Bid, Lot, Sale } from "@auction/types";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { presentLotsImages } from "../lib/media-presenters.js";
import {
  type StoredInvoicePricing,
  checkoutPricingFromInvoice,
} from "../lib/stored-checkout-pricing.js";
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

/** Who is looking: a person, and the buyer account they are looking at, if any. */
type Viewer = { userId: string | null; accountId: string | null };

type SaleLookup = { findByIds(ids: string[]): Promise<Sale[]> };

export class UserDashboardReadService {
  constructor(
    private readonly dashboardQuery: DashboardQueryService,
    private readonly watchlistService: WatchlistService,
    private readonly mediaUrlResolver: MediaUrlResolver | undefined,
    private readonly saleLookup: SaleLookup,
    private readonly mediaAssetEnricher?: MediaAssetEnricher,
    /** A lot that has been invoiced shows the invoice's figures, not its price now. */
    private readonly invoices?: IBidInvoiceBatchReader,
  ) {}

  async listBidsForUser(userId: string): Promise<UserBidWithLot[]> {
    const rows = await this.dashboardQuery.listBidsWithLotsForBidder(userId);
    return this.attachEnrichedLots(rows, { userId, accountId: null });
  }

  /** Bids placed for a buyer account, by everyone or (with `bidderId`) by one member. */
  async listBidsForBuyerAccount(
    buyerLegalEntityId: string,
    bidderId: string | null,
    saleId?: string,
  ): Promise<UserBidWithLot[]> {
    const rows = await this.dashboardQuery.listBidsWithLotsForBuyerAccount(
      buyerLegalEntityId,
      bidderId,
      saleId,
    );
    return this.attachEnrichedLots(rows, { userId: bidderId, accountId: buyerLegalEntityId });
  }

  async listWatchlistForUser(
    userId: string,
    options: WatchlistListOptions = {},
  ): Promise<UserWatchlistRow[]> {
    const rows = await this.watchlistService.listWithLots(userId, options);
    return this.attachEnrichedLots(rows, { userId, accountId: null });
  }

  private async attachEnrichedLots<T extends { lot: Lot | null }>(
    rows: T[],
    viewer: Viewer,
  ): Promise<(T & { lot: Lot | null })[]> {
    const lots = rows.map((r) => r.lot).filter((l): l is Lot => Boolean(l));
    const enriched = await this.enrichLots(lots, viewer);
    const byId = new Map(enriched.map((l) => [l.id, l]));
    return rows.map((row) => ({
      ...row,
      lot: row.lot ? (byId.get(row.lot.id) ?? row.lot) : null,
    }));
  }

  private async enrichLots(lots: Lot[], viewer: Viewer): Promise<Lot[]> {
    if (lots.length === 0) return lots;
    const presented = await presentLotsImages(this.mediaUrlResolver, lots, this.mediaAssetEnricher);
    return this.withCheckoutPricing(presented, viewer);
  }

  private async withCheckoutPricing(lots: Lot[], viewer: Viewer): Promise<Lot[]> {
    const saleIds = [
      ...new Set(
        lots
          .map((l) => l.saleId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const saleRows = await this.saleLookup.findByIds(saleIds);
    const saleById = new Map<string, Sale>(saleRows.map((s) => [s.id, s]));
    const invoices = await this.invoicesFor(lots, viewer);
    return lots.map((lotRow) => {
      const sale = lotRow.saleId ? (saleById.get(lotRow.saleId) ?? null) : null;
      const live = computeLotCheckoutPricing(lotRow, sale);
      const invoice = lotRow.buyerLegalEntityId
        ? invoices.get(bidInvoiceKey(lotRow.id, lotRow.buyerLegalEntityId))
        : undefined;
      return {
        ...lotRow,
        checkoutPricing: invoice ? checkoutPricingFromInvoice(live, invoice) : live,
      };
    });
  }

  /**
   * The stored invoices, in one read, of the lots this viewer is entitled to see them for: lots
   * they won, or lots bought by the account they are looking at. Anyone else (a watcher, an
   * outbid bidder) sees the lot's price as it stands, never another buyer's invoice.
   */
  private async invoicesFor(lots: readonly Lot[], viewer: Viewer) {
    if (!this.invoices) return new Map<string, StoredInvoicePricing>();
    const pairs = lots.flatMap((lot) => {
      const account = lot.buyerLegalEntityId;
      if (!account || !lot.winnerId) return [];
      const mine =
        (viewer.userId !== null && lot.winnerId === viewer.userId) ||
        (viewer.accountId !== null && account === viewer.accountId);
      return mine ? [{ lotId: lot.id, buyerLegalEntityId: account }] : [];
    });
    return this.invoices.findLiveByLotsAndBuyerAccounts(pairs);
  }
}
