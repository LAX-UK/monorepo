import type { PaymentReminderHoldKey } from "@auction/email";
import type {
  BuyerDefaultAudience,
  BuyerDefaultOutcomeKey,
  PaymentReminderStepKey,
} from "@auction/email";
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

  createPaymentReminder(input: {
    userId: string;
    legalEntityId: string | null;
    /** Null for a private sale deal, which has no lot. */
    lotId: string | null;
    lotTitle: string;
    paymentId: string;
    amount: string;
    dueDate: string;
    /** The moment it is due, for the email to show on the reader's own clock. */
    dueAt?: Date;
    step: PaymentReminderStepKey;
    /** The reminder is for a private sale deal: the email calls the item a work, not a lot. */
    privateSale?: boolean;
    /** The invoice cannot be paid yet: the reminder says what to do instead. */
    held?: PaymentReminderHoldKey | null;
  }): CreateNotificationRow;

  /** A private sale buyer is reminded to collect the work they have paid for. */
  createDealCollectionReminder(input: {
    userId: string;
    legalEntityId: string | null;
    dealId: string;
    workTitle: string;
    /** The deadline in words ("10 November 2026"). */
    dueDate: string;
    step: PaymentReminderStepKey;
  }): CreateNotificationRow;

  createBuyerDefaultNotice(input: {
    userId: string;
    legalEntityId: string | null;
    lotId: string;
    lotTitle: string;
    amount: string;
    audience: BuyerDefaultAudience;
    outcome: BuyerDefaultOutcomeKey;
    buyerRestricted: boolean;
  }): CreateNotificationRow;

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
      "legalEntityId" | "requesterName" | "requestedRole" | "requestedCapability" | "reason"
    >,
    organisationName?: string | null,
  ): CreateNotificationRow;

  /** The member's request for access was approved or declined. */
  createAccessRequestDecided(
    userId: string,
    request: Pick<
      AccessRequestRow,
      | "legalEntityId"
      | "status"
      | "grantedRole"
      | "decisionNote"
      | "requesterName"
      | "requestedRole"
      | "requestedCapability"
      | "reason"
    >,
    organisationName?: string | null,
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

  /** The person's identity check passed; they can register for a sale. */
  createKycApproved(userId: string): CreateNotificationRow;

  /** The person's identity check did not pass. Carries no reason from the provider. */
  createKycDeclined(userId: string): CreateNotificationRow;
}
