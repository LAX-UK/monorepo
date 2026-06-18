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

/** Fan-out on `display:{saleId}` via Socket.IO event `displayControl` (Redis `sale:{id}:display`). */
export type SaleroomDisplayBidSummary = {
  kind: "bid_summary";
  lotId: string;
  currentPrice: string;
  bidCount: number;
  leaderPaddleNumber: number | null;
  emittedAt: string;
  saleId?: string;
};

export type SaleroomDisplayControlPayload =
  | {
      kind: "fair_warning" | "announcement";
      message?: string;
      emittedAt: string;
      saleId?: string;
    }
  | { kind: "clear"; emittedAt: string; saleId?: string }
  | SaleroomDisplayBidSummary;

export type SaleroomDisplayOverlay = {
  kind: "fair_warning" | "announcement";
  message?: string;
  emittedAt: string;
};

export type SaleroomDisplayLotEstimate = {
  low: string;
  high: string;
  currency: string;
};

export type SaleroomDisplayNextLot = {
  lotNumber: number;
  title: string;
  imageUrl: string | null;
  estimate: SaleroomDisplayLotEstimate | null;
};

export type SaleroomDisplayBidTick = {
  id: string;
  amount: string;
  placedVia: string | null;
  isAutoBid: boolean;
  at: string;
};

export type SaleroomDisplaySnapshot = {
  saleId: string;
  saleTitle: string;
  sessionStatus: "none" | "pending" | "live" | "paused" | "ended";
  currentLotId: string | null;
  currentLot: {
    id: string;
    lotNumber: number;
    title: string;
    imageUrl: string | null;
    currentPrice: string;
    bidCount: number;
    leaderPaddleNumber: number | null;
    estimate: SaleroomDisplayLotEstimate | null;
    minBidIncrement: string;
    recentBids?: SaleroomDisplayBidTick[];
  } | null;
  nextLot: SaleroomDisplayNextLot | null;
  saleProgress: { position: number; total: number } | null;
  saleCoverImageUrl: string | null;
  /** ISO timestamp when the saleroom session went live (for "Live since" on the display). */
  sessionStartedAt: string | null;
  overlay: SaleroomDisplayOverlay | null;
};

export type SaleroomDisplayPairingStart = {
  deviceCode: string;
  userCode: string;
  expiresIn: number;
  interval: number;
};

export type SaleroomDisplayPairPollResult =
  | { status: "authorization_pending" }
  | { status: "expired" }
  | { status: "authorized"; displayToken: string; saleId: string };

export type SaleroomDisplayDeviceRow = {
  id: string;
  saleId: string;
  status: "pending" | "paired" | "revoked" | "expired";
  userCode: string;
  pairedAt: string | null;
  lastSeenAt: string | null;
  isOnline: boolean;
};
