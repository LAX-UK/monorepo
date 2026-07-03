export type BidHistoryEntry = {
  id: string;
  bidderId: string;
  amount: string;
  at: number;
  /** Proxy/engine-raised bid when true. */
  isAutoBid?: boolean;
  /** Bid origin channel when known (web, saleroom, telephone, absentee). */
  placedVia?: string | null;
};
