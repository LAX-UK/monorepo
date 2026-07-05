import type { CreateNotificationRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";

/** Builds persisted notification rows from domain events. */
export interface INotificationFactory {
  createOutbid(lot: Lot, outbidUserId: string): CreateNotificationRow;

  createWon(
    lot: Lot,
    winnerId: string,
    opts?: { hammerPrice?: string; totalDue?: string },
  ): CreateNotificationRow;

  createLost(lot: Lot, bidderId: string): CreateNotificationRow;

  createEndingSoon(lot: Lot, userId: string): CreateNotificationRow;

  createWatchlistStarting(lot: Lot, userId: string): CreateNotificationRow;

  createWatchlistEndingSoon(lot: Lot, userId: string): CreateNotificationRow;

  createPaymentReceived(lot: Lot, buyerId: string): CreateNotificationRow;

  createSellerPaymentReceived(lot: Lot, recipientId: string, amount: string): CreateNotificationRow;

  createConditionReportReady(lot: Lot, userId: string): CreateNotificationRow;

  createConditionReportDeclined(
    lot: Lot,
    userId: string,
    responseNote?: string | null,
  ): CreateNotificationRow;

  createPaymentDue(
    lot: Lot,
    buyerId: string,
    input: { paymentId: string; amount: string; checkoutUrl: string | null; dueDate?: string },
  ): CreateNotificationRow;
}
