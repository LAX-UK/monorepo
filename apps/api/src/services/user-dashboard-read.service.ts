import {
  type IBidInvoiceBatchReader,
  type IPublicLotResultReader,
  bidInvoiceKey,
} from "@auction/persistence/interfaces";
import type { Bid, Lot, PublicLotView, Sale, StaffRoles } from "@auction/types";
import { computeLotCheckoutPricing } from "../lib/lot-checkout-pricing.js";
import { maskLotForPublicView } from "../lib/lot-public-view.js";
import { presentLotsImages } from "../lib/media-presenters.js";
import { type LotViewer, presentLotsForViewer } from "../lib/public-lot-result.js";
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

/** A lot as the reader may see it: as stored for staff, the public view for everyone else. */
export type DashboardLot = Lot | PublicLotView;
export type UserBidWithLot = { bid: Bid; lot: DashboardLot | null };
export type UserWatchlistRow = Omit<WatchlistWithLot, "lot"> & { lot: DashboardLot | null };

/** The reader's role, which decides whether lots carry staff-only figures such as the reserve. */
export type DashboardViewerAccess = {
  role?: string | undefined;
  staffRoles?: StaffRoles | undefined;
};

/** Who is looking: a person, and the buyer account they are looking at, if any. */
type Viewer = {
  userId: string | null;
  accountId: string | null;
  access?: DashboardViewerAccess | undefined;
};

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
    /** Lots whose result is still open; another reader's view of them shows only that they ended. */
    private readonly publicLotResults?: IPublicLotResultReader,
  ) {}

  async listBidsForUser(userId: string, access?: DashboardViewerAccess): Promise<UserBidWithLot[]> {
    const rows = await this.dashboardQuery.listBidsWithLotsForBidder(userId);
    return this.attachEnrichedLots(rows, { userId, accountId: null, access }, bidAccounts(rows));
  }

  /** Bids placed for a buyer account, by everyone or (with `bidderId`) by one member. */
  async listBidsForBuyerAccount(
    buyerLegalEntityId: string,
    bidderId: string | null,
    saleId?: string,
    access?: DashboardViewerAccess,
  ): Promise<UserBidWithLot[]> {
    const rows = await this.dashboardQuery.listBidsWithLotsForBuyerAccount(
      buyerLegalEntityId,
      bidderId,
      saleId,
    );
    return this.attachEnrichedLots(
      rows,
      { userId: bidderId, accountId: buyerLegalEntityId, access },
      [buyerLegalEntityId],
    );
  }

  async listWatchlistForUser(
    userId: string,
    options: WatchlistListOptions = {},
    access?: DashboardViewerAccess,
  ): Promise<UserWatchlistRow[]> {
    const rows = await this.watchlistService.listWithLots(userId, options);
    return this.attachEnrichedLots(rows, { userId, accountId: null, access });
  }

  /**
   * `buyerAccounts` are the accounts the reader acts for here: a lot bought by one of them, or by
   * the reader, is theirs and shows its buyer and price. Every other lot is shown as the public
   * sees it, without the buyer's ids, so a watcher or an outbid bidder never learns who bought it
   * or the price of a result that is still open.
   */
  private async attachEnrichedLots<T extends { lot: Lot | null }>(
    rows: T[],
    viewer: Viewer,
    buyerAccounts: readonly string[] = [],
  ): Promise<(Omit<T, "lot"> & { lot: DashboardLot | null })[]> {
    const raw = rows.map((r) => r.lot).filter((l): l is Lot => Boolean(l));
    const lotViewer: LotViewer = { userId: viewer.userId, accountIds: new Set(buyerAccounts) };
    const lots = await presentLotsForViewer(this.publicLotResults, raw, lotViewer);
    const enriched = await this.enrichLots(lots, viewer);
    const byId = new Map(enriched.map((l) => [l.id, l]));
    return rows.map((row) => ({
      ...row,
      lot: row.lot
        ? (byId.get(row.lot.id) ??
          maskLotForPublicView(row.lot, viewer.access?.role, viewer.access?.staffRoles))
        : null,
    }));
  }

  private async enrichLots(lots: Lot[], viewer: Viewer): Promise<DashboardLot[]> {
    if (lots.length === 0) return lots;
    const presented = await presentLotsImages(this.mediaUrlResolver, lots, this.mediaAssetEnricher);
    return this.withCheckoutPricing(presented, viewer);
  }

  private async withCheckoutPricing(lots: Lot[], viewer: Viewer): Promise<DashboardLot[]> {
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
      // Mask first, then price: no reserve amount for non-staff, and an open sealed lot's real
      // price must not leak through its checkout figures.
      const shown = maskLotForPublicView(lotRow, viewer.access?.role, viewer.access?.staffRoles);
      // An open result has no price to show yet.
      if (shown.resultPending) return shown;
      const live = computeLotCheckoutPricing(shown, sale);
      const invoice = lotRow.buyerLegalEntityId
        ? invoices.get(bidInvoiceKey(lotRow.id, lotRow.buyerLegalEntityId))
        : undefined;
      return {
        ...shown,
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

/** The buyer accounts the reader bid for: they act for these, so a lot one of them won is theirs. */
function bidAccounts(rows: readonly { bid: Bid }[]): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.bid.buyerLegalEntityId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ];
}
