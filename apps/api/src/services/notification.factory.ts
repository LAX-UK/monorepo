import type { CreateNotificationRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";

/** SRP: builds persisted notification rows from domain events. */
export class NotificationFactory {
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

  createPaymentReceived(lot: Lot, buyerId: string): CreateNotificationRow {
    return {
      userId: buyerId,
      type: "payment_received",
      title: "Payment received",
      message: `Your payment for "${lot.title}" was recorded.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }

  createSellerPaymentReceived(
    lot: Lot,
    recipientId: string,
    amount: string,
  ): CreateNotificationRow {
    return {
      userId: recipientId,
      type: "payment_received",
      title: "Payment received",
      message: `Payment of ${amount} was recorded for "${lot.title}".`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }

  createConditionReportReady(lot: Lot, userId: string): CreateNotificationRow {
    return {
      userId,
      type: "condition_report_ready",
      title: "Condition report ready",
      message: `Your condition report for "${lot.title}" is ready to view.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title },
    };
  }

  createConditionReportDeclined(
    lot: Lot,
    userId: string,
    responseNote?: string | null,
  ): CreateNotificationRow {
    const detail =
      responseNote && responseNote.trim().length > 0
        ? ` ${responseNote.trim()}`
        : " Contact support if you have questions.";
    return {
      userId,
      type: "condition_report_declined",
      title: "Condition report unavailable",
      message: `We could not provide a condition report for "${lot.title}".${detail}`,
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
        invoiceNumber: `PAY-${input.paymentId.slice(0, 8).toUpperCase()}`,
        lotTitle: lot.title,
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
      },
    };
  }
}
