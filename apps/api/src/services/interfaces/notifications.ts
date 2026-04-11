import type { Auction, Bid } from "@auction/types";

export interface INotificationSender {
  notifyBidPlaced(auction: Auction, bid: Bid): Promise<void>;
  notifyAuctionExtended(auction: Auction, newEndTime: Date): Promise<void>;
}
