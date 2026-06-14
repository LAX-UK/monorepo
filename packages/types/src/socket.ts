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
  /** When true, bid was placed by the proxy engine (not a manual confirm). */
  isAutoBid?: boolean | undefined;
  /** User who placed the bid (for “your auto-bid placed £X” toasts). */
  placedByUserId?: string | undefined;
  /** Step used for this auto bid row, when applicable. */
  autoBidStepAmount?: string | undefined;
  /** Origin channel for the leading bid row (web, saleroom, telephone, absentee). */
  placedVia?: string | null | undefined;
  /** Total bids on the lot after this update (when provided by the API). */
  bidCount?: number | undefined;
};

export type LotEndedEvent = {
  type: "lot_ended";
  lotId: string;
  /** Absent when the lot ends with no winner (no-sale / unsold). */
  winnerId?: string | null;
  bidId?: string | null;
  currentPrice: string;
  status: string;
  noSale?: boolean;
};

export type LotStateEvent = {
  lotId: string;
  currentPrice: string;
  endTime: string;
  status: string;
};

/** Fan-out on `sale:{saleId}` via Socket.IO event `saleroomEvent` (Redis `sale:{id}:saleroom`). */
export type SaleroomRealtimePayload = {
  kind: string;
  saleId: string;
  emittedAt: string;
  lotId?: string;
};
