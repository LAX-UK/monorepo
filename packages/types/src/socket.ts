export type JoinLotPayload = {
  lotId: string;
};

export type PlaceBidPayload = {
  lotId: string;
  amount: number;
};

export type BidUpdateEvent = {
  lotId: string;
  bidId: string;
  bidderId: string;
  amount: string;
  currentPrice: string;
  endTime?: string | undefined;
  /** Present when the previous high bidder was displaced (for outbid toasts). */
  outbidUserId?: string | undefined;
  /** Server wall-clock ms when the API published the bid event (propagation diagnostics). */
  emittedAt?: number | undefined;
};

export type LotEndedEvent = {
  type: "lot_ended";
  lotId: string;
  winnerId: string;
  bidId: string;
  currentPrice: string;
  status: string;
};

export type LotStateEvent = {
  lotId: string;
  currentPrice: string;
  endTime: string;
  status: string;
};
