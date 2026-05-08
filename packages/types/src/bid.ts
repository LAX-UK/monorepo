export type Bid = {
  id: string;
  lotId: string;
  /** Transitional compatibility only; new API mappers do not emit this field. */
  bidderId?: string;
  /** Human user who placed the bid (audit trail). */
  placedByUserId?: string | undefined;
  /** Acting legal entity at time of bid. */
  buyerLegalEntityId?: string | undefined;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  maxAutoBidAmount: string | null;
  createdAt: Date;
};

export type NewBid = {
  /** Transitional compatibility for old call sites; prefer placedByUserId. */
  bidderId?: string;
  placedByUserId?: string;
  buyerLegalEntityId?: string;
  amount: number;
};
