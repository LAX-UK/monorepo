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
