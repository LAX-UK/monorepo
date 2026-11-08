import type {
  PrivateSaleDealStage,
  PrivateSalePartyRole,
  PrivateSalePaymentRail,
  PrivateSaleStageChange,
} from "@auction/types";

export const PRIVATE_SALE_DEAL_EVENT_AGGREGATE = "private_sale_deal";

type DealRef = { id: string; reference: string };

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
    };

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
