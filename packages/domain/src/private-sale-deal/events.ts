import type {
  PrivateSaleArtworkUnlinkedReason,
  PrivateSaleDealStage,
  PrivateSalePartyRole,
  PrivateSalePaymentRail,
  PrivateSaleStageChange,
} from "@auction/types";
import type { SettlementFollowUpSeverity } from "./settlement-follow-up.js";

export const PRIVATE_SALE_DEAL_EVENT_AGGREGATE = "private_sale_deal";

type DealRef = { id: string; reference: string };

/** What a deal's artwork was or is: identifiers only, never the staff's own words. */
export type DealArtworkSnapshot = {
  artworkRegisterId: string | null;
  unlinkedReason: PrivateSaleArtworkUnlinkedReason | null;
};

export type PrivateSaleDealEvent =
  | {
      eventType: "private_sale_deal.created";
      payload: { dealId: string; reference: string; stage: PrivateSaleDealStage };
    }
  | {
      eventType: "private_sale_deal.stage_changed";
      payload: {
        dealId: string;
        reference: string;
        from: PrivateSaleDealStage;
        to: PrivateSaleDealStage;
      };
    }
  | {
      eventType: "private_sale_deal.terms_changed";
      payload: { dealId: string; reference: string; fields: string[] };
    }
  | {
      eventType: "private_sale_deal.bank_transfer_recorded";
      payload: { dealId: string; reference: string; paymentId: string; amountMinor: number };
    }
  | {
      eventType: "private_sale_deal.bank_refund_recorded";
      payload: {
        dealId: string;
        reference: string;
        paymentId: string;
        amountMinor: number;
        refundedMinor: number;
        bankReference: string;
      };
    }
  | {
      eventType: "private_sale_deal.payment_partly_refunded";
      payload: {
        dealId: string;
        reference: string;
        paymentId: string;
        amountMinor: number;
        refundedMinor: number;
      };
    }
  | {
      eventType: "private_sale_deal.party_named";
      payload: {
        dealId: string;
        reference: string;
        role: PrivateSalePartyRole;
        /** The member named, kept so a person later replaced is still on the record. */
        actingUserId: string | null;
      };
    }
  | {
      eventType: "private_sale_deal.terms_accepted";
      payload: { dealId: string; reference: string; role: PrivateSalePartyRole; version: string };
    }
  | {
      eventType: "private_sale_deal.payment_started";
      payload: {
        dealId: string;
        reference: string;
        paymentId: string;
        rail: PrivateSalePaymentRail;
        amountMinor: number;
      };
    }
  | {
      eventType: "private_sale_deal.payment_paid";
      payload: { dealId: string; reference: string; paymentId: string; amountMinor: number };
    }
  | {
      eventType: "private_sale_deal.payment_cancelled";
      payload: { dealId: string; reference: string; paymentId: string; reason: string };
    }
  | {
      eventType: "private_sale_deal.payment_refunded";
      payload: { dealId: string; reference: string; paymentId: string; amountMinor: number };
    }
  | {
      eventType: "private_sale_deal.payout_queued";
      payload: { dealId: string; reference: string; payoutId: string; netToSellerMinor: number };
    }
  | {
      eventType:
        | "private_sale_deal.artwork_linked"
        | "private_sale_deal.artwork_changed"
        | "private_sale_deal.artwork_removed";
      payload: {
        dealId: string;
        reference: string;
        /** The register artwork before and after, and the reason recorded when there is none. */
        from: DealArtworkSnapshot;
        to: DealArtworkSnapshot;
      };
    }
  | {
      eventType: "private_sale_deal.artwork_record_not_updated";
      payload: {
        dealId: string;
        reference: string;
        stage: PrivateSaleDealStage;
        reason: "skipped" | "failed";
        message: string;
      };
    }
  | {
      eventType: "private_sale_deal.settlement_follow_up_raised";
      payload: {
        dealId: string;
        reference: string;
        severity: SettlementFollowUpSeverity;
      };
    }
  | {
      eventType: "private_sale_deal.artwork_mark_sold_retried";
      payload: {
        dealId: string;
        reference: string;
        outcome: MarkSoldOutcome;
      };
    };

/** What a staff member's "Try again" achieved in the register. */
export type MarkSoldOutcome = "marked" | "already_marked" | "skipped" | "failed";

/**
 * The events a deal publishes carry identifiers, stage codes and amounts only. Names, the cancel
 * reason and the parties stay on the deal, so the event log holds no personal data.
 */
export function dealCreatedEvent(deal: DealRef): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.created",
    payload: { dealId: deal.id, reference: deal.reference, stage: "proposed" },
  };
}

export function dealStageChangedEvent(
  deal: DealRef,
  change: Pick<PrivateSaleStageChange, "from" | "to">,
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.stage_changed",
    payload: { dealId: deal.id, reference: deal.reference, from: change.from, to: change.to },
  };
}

/**
 * The deal moved on but the artwork register could not follow, so staff must check where the
 * artwork is. Identifiers, the stage and a fixed sentence only.
 */
export function dealArtworkRecordNotUpdatedEvent(
  deal: DealRef,
  failure: { stage: PrivateSaleDealStage; reason: "skipped" | "failed" },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.artwork_record_not_updated",
    payload: {
      dealId: deal.id,
      reference: deal.reference,
      stage: failure.stage,
      reason: failure.reason,
      message: `Deal ${deal.reference} ${failure.stage}, but the artwork's record couldn't be marked sold — check where it is`,
    },
  };
}

/**
 * The daily check found a settled deal whose artwork the register does not show as sold. Raised
 * once per deal, so the audit log says when staff were first told. Identifiers and the severity only.
 */
export function dealSettlementFollowUpRaisedEvent(
  deal: DealRef,
  severity: SettlementFollowUpSeverity,
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.settlement_follow_up_raised",
    payload: { dealId: deal.id, reference: deal.reference, severity },
  };
}

/** Staff asked the register to mark the settled deal's artwork sold again, and what came of it. */
export function dealArtworkMarkSoldRetriedEvent(
  deal: DealRef,
  outcome: MarkSoldOutcome,
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.artwork_mark_sold_retried",
    payload: { dealId: deal.id, reference: deal.reference, outcome },
  };
}

const ARTWORK_EVENT_TYPE = {
  link: "private_sale_deal.artwork_linked",
  record_reason: "private_sale_deal.artwork_linked",
  change: "private_sale_deal.artwork_changed",
  replace_reason: "private_sale_deal.artwork_changed",
  remove: "private_sale_deal.artwork_removed",
} as const;

/**
 * The artwork a deal holds was linked, changed or taken off. The reason staff gave stays with the
 * deal's artwork history; the event carries only which artworks were involved.
 */
export function dealArtworkMovedEvent(
  deal: DealRef,
  move: keyof typeof ARTWORK_EVENT_TYPE,
  change: { from: DealArtworkSnapshot; to: DealArtworkSnapshot },
): PrivateSaleDealEvent {
  return {
    eventType: ARTWORK_EVENT_TYPE[move],
    payload: { dealId: deal.id, reference: deal.reference, from: change.from, to: change.to },
  };
}

/** Which terms changed, by name. The values stay on the deal. */
export function dealTermsChangedEvent(
  deal: DealRef,
  fields: readonly string[],
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.terms_changed",
    payload: { dealId: deal.id, reference: deal.reference, fields: [...fields] },
  };
}

export function dealPartyNamedEvent(
  deal: DealRef,
  party: { role: PrivateSalePartyRole; actingUserId: string | null },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.party_named",
    payload: { dealId: deal.id, reference: deal.reference, ...party },
  };
}

export function dealTermsAcceptedEvent(
  deal: DealRef,
  accepted: { role: PrivateSalePartyRole; version: string },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.terms_accepted",
    payload: { dealId: deal.id, reference: deal.reference, ...accepted },
  };
}

export function dealPaymentStartedEvent(
  deal: DealRef,
  payment: { id: string; rail: PrivateSalePaymentRail; amountMinor: number },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.payment_started",
    payload: {
      dealId: deal.id,
      reference: deal.reference,
      paymentId: payment.id,
      rail: payment.rail,
      amountMinor: payment.amountMinor,
    },
  };
}

export function dealPaymentPaidEvent(
  deal: DealRef,
  payment: { id: string; amountMinor: number },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.payment_paid",
    payload: {
      dealId: deal.id,
      reference: deal.reference,
      paymentId: payment.id,
      amountMinor: payment.amountMinor,
    },
  };
}

/** `reason` is a code such as `checkout_expired`, never free text. */
export function dealPaymentCancelledEvent(
  deal: DealRef,
  payment: { id: string },
  reason: string,
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.payment_cancelled",
    payload: { dealId: deal.id, reference: deal.reference, paymentId: payment.id, reason },
  };
}

export function dealPaymentRefundedEvent(
  deal: DealRef,
  payment: { id: string; amountMinor: number },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.payment_refunded",
    payload: {
      dealId: deal.id,
      reference: deal.reference,
      paymentId: payment.id,
      amountMinor: payment.amountMinor,
    },
  };
}

/** Finance saw a bank transfer land and recorded it; the bank's reference stays on the payment. */
export function dealBankTransferRecordedEvent(
  deal: DealRef,
  payment: { id: string; amountMinor: number },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.bank_transfer_recorded",
    payload: {
      dealId: deal.id,
      reference: deal.reference,
      paymentId: payment.id,
      amountMinor: payment.amountMinor,
    },
  };
}

/** Part of the buyer's payment went back; `refundedMinor` is the total returned so far. */
export function dealPaymentPartlyRefundedEvent(
  deal: DealRef,
  payment: { id: string; amountMinor: number; refundedMinor: number },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.payment_partly_refunded",
    payload: {
      dealId: deal.id,
      reference: deal.reference,
      paymentId: payment.id,
      amountMinor: payment.amountMinor,
      refundedMinor: payment.refundedMinor,
    },
  };
}

/** Finance returned money by bank for a transfer they had recorded; `refundedMinor` is the total so far. */
export function dealBankRefundRecordedEvent(
  deal: DealRef,
  refund: {
    paymentId: string;
    amountMinor: number;
    refundedMinor: number;
    bankReference: string;
  },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.bank_refund_recorded",
    payload: { dealId: deal.id, reference: deal.reference, ...refund },
  };
}

export function dealPayoutQueuedEvent(
  deal: DealRef,
  payout: { id: string; netToSellerMinor: number },
): PrivateSaleDealEvent {
  return {
    eventType: "private_sale_deal.payout_queued",
    payload: {
      dealId: deal.id,
      reference: deal.reference,
      payoutId: payout.id,
      netToSellerMinor: payout.netToSellerMinor,
    },
  };
}
