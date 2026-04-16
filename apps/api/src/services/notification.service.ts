import type { Auction, Bid } from "@auction/types";
import type {
  BidPlacedRealtimeMeta,
  IAuctionNotificationSender,
  IBidNotificationSender,
} from "./interfaces/notifications.js";

/**
 * Application-level notifications — delegates to segregated senders (ISP).
 */
export class NotificationService {
  constructor(
    private readonly bidSender: IBidNotificationSender,
    private readonly auctionSender: IAuctionNotificationSender,
  ) {}

  notifyBidPlaced(auction: Auction, bid: Bid, meta?: BidPlacedRealtimeMeta): Promise<void> {
    return this.bidSender.notifyBidPlaced(auction, bid, meta);
  }

  notifyAuctionExtended(auction: Auction, newEndTime: Date): Promise<void> {
    return this.auctionSender.notifyAuctionExtended(auction, newEndTime);
  }

  notifyAuctionEnded(auction: Auction, bid: Bid): Promise<void> {
    return this.auctionSender.notifyAuctionEnded(auction, bid);
  }
}
