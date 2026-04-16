import type { Auction, Bid } from "@auction/types";

export type BidPlacedRealtimeMeta = {
  /** Previous high bidder (for client-side outbid toast). */
  outbidUserId?: string | undefined;
};

/** ISP: bid-related realtime / outbound notifications only. */
export interface IBidNotificationSender {
  notifyBidPlaced(auction: Auction, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void>;
}

/** ISP: auction lifecycle notifications (extensions, etc.). */
export interface IAuctionNotificationSender {
  notifyAuctionExtended(auction: Auction, newEndTime: Date): Promise<void>;
  notifyAuctionEnded(auction: Auction, bid: Bid): Promise<void>;
}
