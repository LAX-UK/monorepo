import { isTerminalDisputeStatus } from "@auction/domain";
import type { DisputeStripeSnapshot } from "@auction/persistence/interfaces";
import type Stripe from "stripe";

const fromUnixSeconds = (seconds: number | null | undefined): Date | null =>
  typeof seconds === "number" && Number.isFinite(seconds) ? new Date(seconds * 1000) : null;

export function disputeChargeId(dispute: Stripe.Dispute): string | null {
  return typeof dispute.charge === "string" ? dispute.charge : (dispute.charge?.id ?? null);
}

export function disputePaymentIntentId(dispute: Stripe.Dispute): string | null {
  const pi = dispute.payment_intent;
  return typeof pi === "string" ? pi : (pi?.id ?? null);
}

/** The card's last four digits, when the webhook carried the charge expanded. */
function cardLast4(dispute: Stripe.Dispute): string | null {
  if (typeof dispute.charge !== "object" || dispute.charge === null) return null;
  return dispute.charge.payment_method_details?.card?.last4 ?? null;
}

/** When Stripe created the event; a hand-built event without it counts as now. */
export function stripeEventAt(event: Stripe.Event, now: Date): Date {
  return fromUnixSeconds(event.created) ?? now;
}

/** Stripe's copy of the dispute, as this webhook reported it. */
export function disputeSnapshotFromStripe(
  event: Stripe.Event,
  dispute: Stripe.Dispute,
  now: Date,
): DisputeStripeSnapshot {
  const card = dispute.payment_method_details?.card;
  const eventAt = stripeEventAt(event, now);
  return {
    status: dispute.status,
    amountPence: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason ?? null,
    networkReasonCode: card?.network_reason_code ?? dispute.network_reason_code ?? null,
    cardBrand: card?.brand ?? null,
    cardLast4: cardLast4(dispute),
    dueBy: fromUnixSeconds(dispute.evidence_details?.due_by),
    evidenceSubmitted: (dispute.evidence_details?.submission_count ?? 0) > 0,
    chargeRefundable:
      typeof dispute.is_charge_refundable === "boolean" ? dispute.is_charge_refundable : null,
    eventAt,
    closedAt: isTerminalDisputeStatus(dispute.status) ? eventAt : null,
  };
}

/** When Stripe opened the dispute. */
export function disputeCreatedAt(dispute: Stripe.Dispute, fallback: Date): Date {
  return fromUnixSeconds(dispute.created) ?? fallback;
}
