import type { AuctionEndedEvent, BidUpdateEvent } from "@auction/types";

export type BidUpdateHandler = (event: BidUpdateEvent) => void;

export type AuctionRealtimeCallbacks = {
  onBidUpdate?: BidUpdateHandler;
  onAuctionExtended?: (payload: unknown) => void;
  onAuctionEnded?: (payload: AuctionEndedEvent) => void;
  onAuctionEvent?: (payload: unknown) => void;
};

/** Narrow port for auction rooms — no raw Socket exposure (ISP). */
export interface AuctionRealtimePort {
  subscribeToAuction(auctionId: string, callbacks: AuctionRealtimeCallbacks): () => void;
  leaveAuction(auctionId: string): void;
}
