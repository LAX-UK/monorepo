import type { CreateNotificationRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import type { INotificationFactory } from "./ports.js";

/** Builds persisted notification rows from domain events (shared API/worker bidding). */
export class NotificationFactory implements INotificationFactory {
  createOutbid(lot: Lot, outbidUserId: string): CreateNotificationRow {
    return {
      userId: outbidUserId,
      type: "outbid",
      title: "You have been outbid",
      message: `Another bidder placed a higher bid on "${lot.title}".`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
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
        ...(opts?.hammerPrice ? { hammerPrice: opts.hammerPrice } : {}),
        ...(opts?.totalDue ? { totalDue: opts.totalDue } : {}),
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
