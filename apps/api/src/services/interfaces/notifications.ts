import type { Auction, Bid } from "@auction/types";

/** ISP: bid-related realtime / outbound notifications only. */
export interface IBidNotificationSender {
  notifyBidPlaced(auction: Auction, bid: Bid): Promise<void>;
}

/** ISP: auction lifecycle notifications (extensions, etc.). */
export interface IAuctionNotificationSender {
  notifyAuctionExtended(auction: Auction, newEndTime: Date): Promise<void>;
}
