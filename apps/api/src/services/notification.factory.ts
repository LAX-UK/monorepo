import { KYC_APPROVED_COPY, KYC_DECLINED_COPY } from "@auction/branding";
import type { PaymentReminderHoldKey } from "@auction/email";
import { buyerDefaultCopy, formatMoneyMajor, paymentReminderCopy } from "@auction/email";
import type {
  BuyerDefaultAudience,
  BuyerDefaultOutcomeKey,
  PaymentReminderStepKey,
} from "@auction/email";
import { paymentDueNotification } from "@auction/finance-runtime";
import type { AccessRequestRow, CreateNotificationRow } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import type { Lot } from "@auction/types";
import type { INotificationFactory } from "./interfaces/notification-factory.js";

/** SRP: builds persisted notification rows from domain events. */
export class NotificationFactory implements INotificationFactory {
  createOutbid(
    lot: Lot,
    outbidUserId: string,
    legalEntityId: string | null,
    opts?: { currentBid?: string },
  ): CreateNotificationRow {
    return {
      userId: outbidUserId,
      type: "outbid",
      title: "You have been outbid",
      message: `Another bidder placed a higher bid on "${lot.title}".`,
      lotId: lot.id,
      legalEntityId,
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
      legalEntityId: lot.buyerLegalEntityId ?? null,
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
        ? `"${lot.title}" sold with a hammer price of ${formatMoneyMajor(opts?.hammerPrice) ?? opts?.hammerPrice}.`
        : `"${lot.title}" closed without a sale. Choose what happens next: relist it, offer it by private sale, or have it returned.`,
      lotId: lot.id,
      legalEntityId: lot.sellerLegalEntityId ?? null,
      meta: {
        lotTitle: lot.title,
        outcome: sold ? "sold" : "unsold",
        ...(sold && opts?.hammerPrice ? { hammerPrice: opts.hammerPrice } : {}),
      },
    };
  }

  createLost(lot: Lot, bidderId: string, legalEntityId: string | null): CreateNotificationRow {
    return {
      userId: bidderId,
      type: "lot_lost",
      title: "Lot ended",
      message: `The lot "${lot.title}" has ended. Another bidder had the winning bid.`,
      lotId: lot.id,
      legalEntityId,
      meta: { lotTitle: lot.title },
    };
  }

  createEndingSoon(lot: Lot, userId: string, legalEntityId: string | null): CreateNotificationRow {
    return {
      userId,
      type: "lot_ending_soon",
      title: "Lot ending soon",
      message: `"${lot.title}" ends in about one hour.`,
      lotId: lot.id,
      legalEntityId,
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
      legalEntityId: null,
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
      legalEntityId: null,
      meta: { lotTitle: lot.title },
    };
  }

  createPaymentReceived(lot: Lot, buyerId: string, amount?: string): CreateNotificationRow {
    return {
      userId: buyerId,
      type: "payment_received",
      title: "Payment received",
      message: `Your payment for "${lot.title}" was recorded.`,
      lotId: lot.id,
      legalEntityId: lot.buyerLegalEntityId ?? null,
      meta: { lotTitle: lot.title, audience: "buyer", ...(amount ? { amount } : {}) },
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
      message: `Payment of ${formatMoneyMajor(amount) ?? amount} was recorded for "${lot.title}".`,
      lotId: lot.id,
      legalEntityId: lot.sellerLegalEntityId ?? null,
      meta: { lotTitle: lot.title, audience: "seller", amount },
    };
  }

  createConditionReportReady(
    lot: Lot,
    userId: string,
    legalEntityId: string | null,
  ): CreateNotificationRow {
    return {
      userId,
      type: "condition_report_ready",
      title: "Condition report ready",
      message: `Your condition report for "${lot.title}" is ready to view.`,
      lotId: lot.id,
      legalEntityId,
      meta: { lotTitle: lot.title },
    };
  }

  createConditionReportDeclined(
    lot: Lot,
    userId: string,
    legalEntityId: string | null,
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
      legalEntityId,
      meta: { lotTitle: lot.title },
    };
  }

  createPaymentDue(
    lot: Lot,
    buyerId: string,
    input: { paymentId: string; amount: string; checkoutUrl: string | null; dueDate?: string },
  ): CreateNotificationRow {
    return paymentDueNotification(lot, buyerId, input);
  }

  createPaymentReminder(input: {
    userId: string;
    legalEntityId: string | null;
    /** Null for a private sale deal, which has no lot. */
    lotId: string | null;
    lotTitle: string;
    paymentId: string;
    amount: string;
    /** The due date in words ("10 November 2026"). */
    dueDate: string;
    step: PaymentReminderStepKey;
    /** The reminder is for a private sale deal: the email calls the item a work, not a lot. */
    privateSale?: boolean;
    /** The invoice cannot be paid yet: the reminder says what to do instead. */
    held?: PaymentReminderHoldKey | null;
  }): CreateNotificationRow {
    const amount = formatMoneyMajor(input.amount) ?? input.amount;
    const copy = paymentReminderCopy(input.step, {
      lotTitle: input.lotTitle,
      amount,
      dueDate: input.dueDate,
      held: input.held ?? null,
    });
    return {
      userId: input.userId,
      type: "payment_reminder",
      title: copy.title,
      message: copy.paragraphs[0] ?? copy.heading,
      ...(input.lotId ? { lotId: input.lotId } : {}),
      legalEntityId: input.legalEntityId,
      meta: {
        paymentId: input.paymentId,
        amount: input.amount,
        dueDate: input.dueDate,
        lotTitle: input.lotTitle,
        reminderStep: input.step,
        ...(input.held ? { heldReason: input.held } : {}),
        ...(input.privateSale ? { privateSale: true } : {}),
        audience: "buyer",
        // One email per person per step: an organisation's payers are each reminded.
        emailIdempotencyKey: `payment-reminder:${input.paymentId}:${input.step}:${input.userId}`,
      },
    };
  }

  createDealCollectionReminder(input: {
    userId: string;
    legalEntityId: string | null;
    dealId: string;
    workTitle: string;
    dueDate: string;
    step: PaymentReminderStepKey;
  }): CreateNotificationRow {
    const copy = dealCollectionReminderCopy(input.step, input.workTitle, input.dueDate);
    return {
      userId: input.userId,
      type: "lot_ready_for_collection",
      title: copy.title,
      message: copy.message,
      legalEntityId: input.legalEntityId,
      meta: {
        lotTitle: input.workTitle,
        dueDate: input.dueDate,
        reminderStep: input.step,
        audience: "buyer",
        // One email per person per step.
        emailIdempotencyKey: `private-sale-collection-reminder:${input.dealId}:${input.step}:${input.userId}`,
      },
    };
  }

  createBuyerDefaultNotice(input: {
    userId: string;
    legalEntityId: string | null;
    lotId: string;
    lotTitle: string;
    amount: string;
    audience: BuyerDefaultAudience;
    outcome: BuyerDefaultOutcomeKey;
    buyerRestricted: boolean;
  }): CreateNotificationRow {
    const copy = buyerDefaultCopy(input.audience, {
      lotTitle: input.lotTitle,
      amount: formatMoneyMajor(input.amount) ?? input.amount,
      outcome: input.outcome,
      buyerRestricted: input.buyerRestricted,
    });
    return {
      userId: input.userId,
      type: "buyer_default_notice",
      title: copy.title,
      message: copy.paragraphs.join(" "),
      lotId: input.lotId,
      legalEntityId: input.legalEntityId,
      meta: {
        amount: input.amount,
        lotTitle: input.lotTitle,
        audience: input.audience,
        defaultOutcome: input.outcome,
        buyerRestricted: input.buyerRestricted,
      },
    };
  }

  createAccessRequested(
    userId: string,
    request: Pick<
      AccessRequestRow,
      "legalEntityId" | "requesterName" | "requestedRole" | "requestedCapability" | "reason"
    >,
    organisationName?: string | null,
  ): CreateNotificationRow {
    const who = request.requesterName?.trim() || "A member";
    const what = requestedWords(request);
    return {
      userId,
      type: "access_requested",
      legalEntityId: request.legalEntityId,
      title: "Someone asked for access",
      message: `${who} asked for ${what}. Open Team to approve or decline.`,
      meta: {
        ...(organisationName ? { organisationName } : {}),
        accessRequest: {
          requesterName: who,
          requested: what,
          reason: request.reason?.trim() || null,
        },
      },
    };
  }

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
  ): CreateNotificationRow {
    const approved = request.status === "approved";
    const note = request.decisionNote?.trim();
    const meta: NonNullable<CreateNotificationRow["meta"]> = {
      ...(organisationName ? { organisationName } : {}),
      accessRequest: {
        requesterName: request.requesterName?.trim() || "A member",
        requested: requestedWords(request),
        reason: request.reason?.trim() || null,
        approved,
        grantedRole: approved ? roleWords(request.grantedRole ?? "viewer") : null,
        note: note || null,
      },
    };
    return {
      userId,
      type: "access_request_decided",
      legalEntityId: request.legalEntityId,
      title: approved ? "Your access request was approved" : "Your access request was declined",
      message: approved
        ? `You now have the ${roleWords(request.grantedRole ?? "viewer")} role.${note ? ` ${note}` : ""}`
        : note || "An owner or admin declined it. Ask them if you need it for your work.",
      meta,
    };
  }

  createPayoutProblem(
    userId: string,
    input: { payoutId: string; amount: string; currency: string; legalEntityId: string },
  ): CreateNotificationRow {
    return {
      userId,
      type: "payout_problem",
      legalEntityId: input.legalEntityId,
      title: "A payout didn't reach your bank",
      message: `Your payout of ${formatMoneyMajor(input.amount, input.currency) ?? `${input.amount} ${input.currency}`} didn't go through. Our finance team is looking into it and will contact you. Check that your bank details are up to date.`,
      meta: { amount: input.amount },
    };
  }

  createDeliveryQuoteReady(
    lot: Lot,
    userId: string,
    input: { amount: string; currency: string; legalEntityId: string },
  ): CreateNotificationRow {
    return {
      userId,
      type: "delivery_quote_ready",
      legalEntityId: input.legalEntityId,
      title: "Your delivery quote is ready",
      message: `Delivery for "${lot.title}" is quoted at ${formatMoneyMajor(input.amount, input.currency) ?? `${input.amount} ${input.currency}`}. Open the purchase to accept it.`,
      lotId: lot.id,
      meta: { lotTitle: lot.title, amount: input.amount },
    };
  }

  createLotReadyForCollection(
    lot: Lot,
    buyerId: string,
    input?: { collectionPlace?: string | null },
  ): CreateNotificationRow {
    const place = input?.collectionPlace?.trim();
    return {
      userId: buyerId,
      type: "lot_ready_for_collection",
      title: "Your lot is ready to collect",
      message: place
        ? `"${lot.title}" is ready for you to collect from ${place}.`
        : `"${lot.title}" is ready for you to collect. Open your purchase for the collection details.`,
      lotId: lot.id,
      legalEntityId: lot.buyerLegalEntityId ?? null,
      meta: { lotTitle: lot.title, ...(place ? { collectionPlace: place } : {}) },
    };
  }

  createLotShipped(
    lot: Lot,
    buyerId: string,
    input: { carrier: string; trackingNumber: string },
  ): CreateNotificationRow {
    return {
      userId: buyerId,
      type: "lot_shipped",
      title: "Your lot is on its way",
      message: `"${lot.title}" has been sent with ${input.carrier}. Tracking number: ${input.trackingNumber}.`,
      lotId: lot.id,
      legalEntityId: lot.buyerLegalEntityId ?? null,
      meta: { lotTitle: lot.title, carrier: input.carrier, trackingNumber: input.trackingNumber },
    };
  }

  createLotDelivered(
    lot: Lot,
    buyerId: string,
    input: { method: "delivery" | "collection" },
  ): CreateNotificationRow {
    const collected = input.method === "collection";
    return {
      userId: buyerId,
      type: "lot_delivered",
      title: collected ? "Your lot has been collected" : "Your lot has been delivered",
      message: collected
        ? `"${lot.title}" has been collected. Thank you for buying with us.`
        : `"${lot.title}" has been delivered. Thank you for buying with us.`,
      lotId: lot.id,
      legalEntityId: lot.buyerLegalEntityId ?? null,
      meta: { lotTitle: lot.title, fulfilmentMethod: input.method },
    };
  }

  createKycApproved(userId: string): CreateNotificationRow {
    return {
      userId,
      type: "kyc_approved",
      // Identity checks are for the person, so the notice is personal.
      legalEntityId: null,
      title: KYC_APPROVED_COPY.headline,
      message: KYC_APPROVED_COPY.detail,
    };
  }

  createKycDeclined(userId: string): CreateNotificationRow {
    return {
      userId,
      type: "kyc_declined",
      legalEntityId: null,
      title: KYC_DECLINED_COPY.headline,
      message: KYC_DECLINED_COPY.detail,
    };
  }
}

/** A role as people read it in a sentence, never the stored code. */
const ROLE_WORDS: Record<LegalEntityMemberRole, string> = {
  owner: "owner",
  admin: "admin",
  finance: "finance",
  consignor: "consignor",
  viewer: "viewer",
  buyer_agent: "buyer agent",
};

function roleWords(role: LegalEntityMemberRole): string {
  return ROLE_WORDS[role];
}

/** What an access request asked for, in a sentence: "the buyer agent role", "more access". */
function requestedWords(request: Pick<AccessRequestRow, "requestedRole">): string {
  return request.requestedRole ? `the ${roleWords(request.requestedRole)} role` : "more access";
}

/** What a buyer is told about collecting a work they have paid for, by how close the deadline is. */
function dealCollectionReminderCopy(
  step: PaymentReminderStepKey,
  workTitle: string,
  dueDate: string,
): { title: string; message: string } {
  switch (step) {
    case "before_due":
      return {
        title: "Collect your work soon",
        message: `"${workTitle}" is ready for you to collect. Please collect it by ${dueDate}.`,
      };
    case "due_day":
      return {
        title: "Collect your work today",
        message: `Today is the last day to collect "${workTitle}" (${dueDate}). Contact us if you need more time.`,
      };
    case "overdue":
      return {
        title: "Your work is waiting to be collected",
        message: `"${workTitle}" was due for collection on ${dueDate}. Please contact us to arrange it.`,
      };
  }
}
