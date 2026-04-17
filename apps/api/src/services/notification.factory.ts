import type { Auction } from "@auction/types";
import type { CreateNotificationRow } from "./interfaces/notification-write.js";

/** SRP: builds persisted notification rows from domain events. */
export class NotificationFactory {
  createOutbid(auction: Auction, outbidUserId: string): CreateNotificationRow {
    return {
      userId: outbidUserId,
      type: "outbid",
      title: "You have been outbid",
      message: `Another bidder placed a higher bid on "${auction.title}".`,
      auctionId: auction.id,
    };
  }

  createWon(auction: Auction, winnerId: string): CreateNotificationRow {
    return {
      userId: winnerId,
      type: "auction_won",
      title: "Congratulations — you won",
      message: `You won "${auction.title}". Complete payment from your portfolio when ready.`,
      auctionId: auction.id,
    };
  }

  createLost(auction: Auction, bidderId: string): CreateNotificationRow {
    return {
      userId: bidderId,
      type: "auction_lost",
      title: "Auction ended",
      message: `The auction for "${auction.title}" has ended. Another bidder had the winning bid.`,
      auctionId: auction.id,
    };
  }

  createEndingSoon(auction: Auction, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "auction_ending_soon",
      title: "Auction ending soon",
      message: `"${auction.title}" ends in about one hour.`,
      auctionId: auction.id,
    };
  }

  createWatchlistStarting(auction: Auction, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "watchlist_starting",
      title: "Saved lot is now live",
      message: `"${auction.title}" is now accepting bids.`,
      auctionId: auction.id,
    };
  }

  createWatchlistEndingSoon(auction: Auction, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "watchlist_ending_soon",
      title: "Saved lot ending soon",
      message: `"${auction.title}" ends in about one hour.`,
      auctionId: auction.id,
    };
  }

  createPaymentReceived(auction: Auction, buyerId: string): CreateNotificationRow {
    return {
      userId: buyerId,
      type: "payment_received",
      title: "Payment received",
      message: `Your payment for "${auction.title}" was recorded.`,
      auctionId: auction.id,
    };
  }
}
