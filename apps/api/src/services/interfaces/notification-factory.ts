import type { AccessRequestRow, CreateNotificationRow } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";

/** Builds persisted notification rows from domain events. */
export interface INotificationFactory {
  createOutbid(
    lot: Lot,
    outbidUserId: string,
    /** The account the outbid bid was placed for. */
    legalEntityId: string | null,
    opts?: { currentBid?: string },
  ): CreateNotificationRow;

  createWon(
    lot: Lot,
    winnerId: string,
    opts?: { hammerPrice?: string; totalDue?: string },
  ): CreateNotificationRow;

  createEndedSeller(
    lot: Lot,
    sellerId: string,
    opts?: { hammerPrice?: string },
  ): CreateNotificationRow;

  /** `legalEntityId` is the account the bidder bid for. */
  createLost(lot: Lot, bidderId: string, legalEntityId: string | null): CreateNotificationRow;

  createEndingSoon(lot: Lot, userId: string, legalEntityId: string | null): CreateNotificationRow;

  createWatchlistStarting(lot: Lot, userId: string): CreateNotificationRow;

  createWatchlistEndingSoon(lot: Lot, userId: string): CreateNotificationRow;

  createPaymentReceived(lot: Lot, buyerId: string, amount?: string): CreateNotificationRow;

  createSellerPaymentReceived(lot: Lot, recipientId: string, amount: string): CreateNotificationRow;

  createConditionReportReady(
    lot: Lot,
    userId: string,
    legalEntityId: string | null,
  ): CreateNotificationRow;

  createConditionReportDeclined(
    lot: Lot,
    userId: string,
    legalEntityId: string | null,
    responseNote?: string | null,
  ): CreateNotificationRow;

  createPaymentDue(
    lot: Lot,
    buyerId: string,
    input: { paymentId: string; amount: string; checkoutUrl: string | null; dueDate?: string },
  ): CreateNotificationRow;

  /** A member asked for more access; an owner or admin decides. */
  createAccessRequested(
    userId: string,
    request: Pick<
      AccessRequestRow,
      "legalEntityId" | "requesterName" | "requestedRole" | "requestedCapability"
    >,
  ): CreateNotificationRow;

  /** The member's request for access was approved or declined. */
  createAccessRequestDecided(
    userId: string,
    request: Pick<AccessRequestRow, "legalEntityId" | "status" | "grantedRole" | "decisionNote">,
  ): CreateNotificationRow;

  /** A payout failed or was reversed; LAX is on it and the money is not lost. */
  createPayoutProblem(
    userId: string,
    input: { payoutId: string; amount: string; currency: string; legalEntityId: string },
  ): CreateNotificationRow;

  /** A courier quote for a won lot is priced and waiting for the buyer to accept it. */
  createDeliveryQuoteReady(
    lot: Lot,
    userId: string,
    input: { amount: string; currency: string; legalEntityId: string },
  ): CreateNotificationRow;

  createLotReadyForCollection(
    lot: Lot,
    buyerId: string,
    input?: { collectionPlace?: string | null },
  ): CreateNotificationRow;

  createLotShipped(
    lot: Lot,
    buyerId: string,
    input: { carrier: string; trackingNumber: string },
  ): CreateNotificationRow;

  createLotDelivered(
    lot: Lot,
    buyerId: string,
    input: { method: "delivery" | "collection" },
  ): CreateNotificationRow;
}
