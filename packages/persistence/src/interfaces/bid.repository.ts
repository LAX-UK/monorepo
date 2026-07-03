import type { Bid } from "@auction/types";

export type CreateBidRow = {
  lotId: string;
  placedByUserId: string;
  buyerLegalEntityId: string;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  maxAutoBidAmount: string | null;
  autoBidStepAmount?: string | null;
  placedVia?: string | null;
  telephoneBookingId?: string | null;
  clerkUserId?: string | null;
};

export interface IBidRepository {
  create(row: CreateBidRow): Promise<Bid>;
  findHighestForLot(lotId: string): Promise<Bid | null>;
  /** Highest amount first; earliest bid wins ties (settlement). */
  listForLotSettlement(lotId: string, limit: number): Promise<Bid[]>;
  /** Bids for lot close that meet reserve and pass anti-shilling in one query
   * (NOT EXISTS shared-member pattern). `sort: "english"` → amount DESC, created_at ASC;
   * `sort: "dutch"` → created_at ASC only. */
  findEligibleBidsForLotClose(
    lotId: string,
    params: {
      sellerLegalEntityId: string | null;
      reservePrice: string | null;
      sort: "english" | "dutch";
    },
  ): Promise<Bid[]>;
  listForLot(lotId: string, limit: number): Promise<Bid[]>;
  countForLot(lotId: string): Promise<number>;
  findWinningBid(lotId: string): Promise<Bid | null>;
  listDistinctBidderIds(lotId: string): Promise<string[]>;
  /** Latest bids placed by a bidder (for dashboard). */
  listForBidder(bidderId: string, limit: number): Promise<Bid[]>;
  markWinningBid(lotId: string, bidId: string): Promise<void>;
  clearWinningBid(lotId: string): Promise<void>;
  /** Max effective ceiling per bidder for proxy resolution (English / buy-it-now). */
  aggregateBidderCeilings(lotId: string): Promise<Map<string, number>>;
  /** One row per bidder on the lot: ceiling (max of amount vs max auto) and the
   * buyer legal entity from the bid row that defines that ceiling (for anti-shilling).
   */
  listBidderCeilingStates(lotId: string): Promise<
    Array<{
      bidderId: string;
      buyerLegalEntityId: string;
      ceiling: string;
      autoBidStepAmount: string | null;
      maxCreatedAt: Date | null;
    }>
  >;
  /** True when the bidder has at least one bid on the lot with a proxy ceiling set. */
  bidderHasProxyMaxOnLot(lotId: string, bidderId: string): Promise<boolean>;
  /** Clears proxy auto-bid fields for all bids by this bidder on the lot. */
  clearProxyAutoBidForBidderOnLot(lotId: string, bidderId: string): Promise<number>;
  /** Updates proxy ceiling/step on all proxy rows for bidder without placing a new bid. */
  updateProxySettingsForBidderOnLot(
    lotId: string,
    bidderId: string,
    settings: { maxAutoBidAmount: string; autoBidStepAmount: string },
  ): Promise<number>;
  /** Latest proxy settings for a bidder on a lot, if any. */
  findProxySettingsForBidderOnLot(
    lotId: string,
    bidderId: string,
  ): Promise<{ maxAutoBidAmount: string; autoBidStepAmount: string | null } | null>;
  /** distinct (lotId, bidderId) with active proxy ceiling for buyer entity on active lots. */
  listActiveProxyBidPairsForBuyerEntity(
    buyerLegalEntityId: string,
  ): Promise<{ lotId: string; bidderId: string }[]>;
  /** proxy rows for removed member on entity's active lots. */
  listActiveProxyBidPairsForMemberOnEntity(
    placedByUserId: string,
    buyerLegalEntityId: string,
  ): Promise<{ lotId: string; bidderId: string }[]>;
}
