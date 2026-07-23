import type { CreateNotificationRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";

/** Minimal notification row builder for worker-owned lot lifecycle (mirrors API factory). */
export class WorkerNotificationFactory {
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
      title: "Lot ended",
      message: `The lot "${lot.title}" has ended. Another bidder had the winning bid.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }

  createEndingSoon(lot: Lot, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "lot_ending_soon",
      title: "Lot ending soon",
      message: `"${lot.title}" ends in about one hour.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }

  createWatchlistStarting(lot: Lot, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "watchlist_starting",
      title: "Saved lot is now live",
      message: `"${lot.title}" is now accepting bids.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }

  createWatchlistEndingSoon(lot: Lot, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "watchlist_ending_soon",
      title: "Saved lot ending soon",
      message: `"${lot.title}" ends in about one hour.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }

  createPaymentDue(
    lot: Lot,
    buyerId: string,
    input: { paymentId: string; amount: string; checkoutUrl: string | null; dueDate?: string },
  ): CreateNotificationRow {
    const dueSuffix = input.dueDate ? ` Payment due by ${input.dueDate}.` : "";
    return {
      userId: buyerId,
      type: "payment_due",
      title: `Payment due — ${lot.title}`,
      message: `Complete payment of ${input.amount} GBP for this lot.${dueSuffix}`,
      lotId: lot.id,
      meta: {
        paymentId: input.paymentId,
        amount: input.amount,
        invoiceUrl: input.checkoutUrl,
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      },
    };
  }
}

export function notificationRowToPayload(
  row: CreateNotificationRow,
): import("@auction/persistence/interfaces").NotificationPayload {
  return {
    type: row.type,
    title: row.title,
    message: row.message,
    lotId: row.lotId,
    submissionId: row.submissionId,
    ...(row.meta != null ? { meta: row.meta } : {}),
  };
}
