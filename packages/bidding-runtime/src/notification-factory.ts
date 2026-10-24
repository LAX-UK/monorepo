import type { CreateNotificationRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import type { INotificationFactory } from "./ports.js";

/** Builds persisted notification rows from domain events (shared API/worker bidding). */
export class NotificationFactory implements INotificationFactory {
  createOutbid(
    lot: Lot,
    outbidUserId: string,
    opts?: { currentBid?: string },
  ): CreateNotificationRow {
    return {
      userId: outbidUserId,
      type: "outbid",
      title: "You have been outbid",
      message: `Another bidder placed a higher bid on "${lot.title}".`,
      lotId: lot.id,
      meta: { lotTitle: lot.title, ...(opts?.currentBid ? { bidAmount: opts.currentBid } : {}) },
    };
  }

  createWon(
    lot: Lot,
    winnerId: string,
    opts?: { hammerPrice?: string; totalDue?: string },
  ): CreateNotificationRow {
    return {
      userId: winnerId,
      type: "lot_won",
      title: "Congratulations — you won",
      message: `You won "${lot.title}". Complete payment from your portfolio when ready.`,
      lotId: lot.id,
      meta: {
        lotTitle: lot.title,
        bidAmount: lot.currentPrice,
        ...(opts?.hammerPrice ? { hammerPrice: opts.hammerPrice } : {}),
        ...(opts?.totalDue ? { totalDue: opts.totalDue } : {}),
      },
    };
  }

  createEndedSeller(
    lot: Lot,
    sellerId: string,
    opts?: { hammerPrice?: string },
  ): CreateNotificationRow {
    const sold = typeof opts?.hammerPrice === "string" && opts.hammerPrice.length > 0;
    return {
      userId: sellerId,
      type: "lot_ended_seller",
      title: sold ? "Your lot has sold" : "Your lot closed unsold",
      message: sold
        ? `"${lot.title}" sold with a hammer price of ${opts?.hammerPrice} GBP.`
        : `"${lot.title}" closed without a sale.`,
      lotId: lot.id,
      meta: {
        lotTitle: lot.title,
        outcome: sold ? "sold" : "unsold",
        ...(sold && opts?.hammerPrice ? { hammerPrice: opts.hammerPrice } : {}),
      },
    };
  }

  createLost(lot: Lot, bidderId: string): CreateNotificationRow {
    return {
      userId: bidderId,
      type: "lot_lost",
      title: "Lot closed",
      message: `The lot "${lot.title}" has ended without your bid winning.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }
}
