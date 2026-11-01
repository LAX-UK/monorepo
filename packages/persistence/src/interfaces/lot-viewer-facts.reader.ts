import type { LotAuctionType, LotStatus } from "@auction/types";

/** Raw facts about one account's part in one lot, as the database holds them. */
export type LotViewerRawFacts = {
  lotId: string;
  saleId: string | null;
  lotStatus: LotStatus;
  auctionType: LotAuctionType;
  /** Decimal strings, major units. */
  currentPrice: string;
  startingPrice: string;
  minBidIncrement: string;
  /** The account's registration for the lot's sale; `null` when it never registered. */
  registration: "pending" | "approved" | "rejected" | "withdrawn" | null;
  /** The account placed the winning bid on a lot still open. */
  leading: boolean;
  /** The account (or the person, for a personal account) won the lot. */
  won: boolean;
  /** The account has placed at least one bid on the lot. */
  hasBid: boolean;
  /** The account's highest bid, or `null`. */
  highestBid: string | null;
  /** The account's highest proxy ceiling or scheduled absentee bid, or `null`. */
  maxBid: string | null;
  /** The invoice behind a won lot, as far as its payment state needs it. */
  payment: {
    id: string;
    status:
      | "pending"
      | "authorized"
      | "captured"
      | "refunded"
      | "requires_manual_review"
      | "cancelled";
    raisedAt: Date;
  } | null;
};

export type LotViewerFactsQuery = {
  lotIds: readonly string[];
  userId: string;
  /** The account the person is acting for. */
  legalEntityId: string;
};

/**
 * Reads one account's standing on several lots in a handful of queries, however many lots there
 * are. A lot the account has no part in still comes back, with empty facts.
 */
export interface ILotViewerFactsReader {
  load(query: LotViewerFactsQuery): Promise<LotViewerRawFacts[]>;
}
