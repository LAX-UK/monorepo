import type { Lot } from "@auction/types";
import type { CreateNotificationRow } from "./interfaces/notification-write.js";

/** SRP: builds persisted notification rows from domain events. */
export class NotificationFactory {
  createOutbid(lot: Lot, outbidUserId: string): CreateNotificationRow {
    return {
      userId: outbidUserId,
      type: "outbid",
      title: "You have been outbid",
      message: `Another bidder placed a higher bid on "${lot.title}".`,
      lotId: lot.id,
    };
  }

  createWon(lot: Lot, winnerId: string): CreateNotificationRow {
    return {
      userId: winnerId,
      type: "lot_won",
      title: "Congratulations — you won",
      message: `You won "${lot.title}". Complete payment from your portfolio when ready.`,
      lotId: lot.id,
    };
  }

  createLost(lot: Lot, bidderId: string): CreateNotificationRow {
    return {
      userId: bidderId,
      type: "lot_lost",
      title: "Lot ended",
      message: `The lot "${lot.title}" has ended. Another bidder had the winning bid.`,
      lotId: lot.id,
    };
  }

  createEndingSoon(lot: Lot, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "lot_ending_soon",
      title: "Lot ending soon",
      message: `"${lot.title}" ends in about one hour.`,
      lotId: lot.id,
    };
  }

  createWatchlistStarting(lot: Lot, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "watchlist_starting",
      title: "Saved lot is now live",
      message: `"${lot.title}" is now accepting bids.`,
      lotId: lot.id,
    };
  }

  createWatchlistEndingSoon(lot: Lot, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "watchlist_ending_soon",
      title: "Saved lot ending soon",
      message: `"${lot.title}" ends in about one hour.`,
      lotId: lot.id,
    };
  }

  createPaymentReceived(lot: Lot, buyerId: string): CreateNotificationRow {
    return {
      userId: buyerId,
      type: "payment_received",
      title: "Payment received",
      message: `Your payment for "${lot.title}" was recorded.`,
      lotId: lot.id,
    };
  }
}
