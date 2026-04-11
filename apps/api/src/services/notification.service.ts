import type { Auction, Bid } from "@auction/types";
import type { INotificationSender } from "./interfaces/notifications.js";

/**
 * Application-level notifications — delegates to {@link INotificationSender} (Redis pub/sub, etc.).
 */
export class NotificationService {
  constructor(private readonly sender: INotificationSender) {}

  notifyBidPlaced(auction: Auction, bid: Bid): Promise<void> {
    return this.sender.notifyBidPlaced(auction, bid);
  }

  notifyAuctionExtended(auction: Auction, newEndTime: Date): Promise<void> {
    return this.sender.notifyAuctionExtended(auction, newEndTime);
  }
}
