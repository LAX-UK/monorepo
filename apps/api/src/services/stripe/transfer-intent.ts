import type Stripe from "stripe";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrNull = (value: string | undefined): string | null =>
  value && UUID.test(value) ? value : null;

/** What a bank-transfer payment intent shows of itself and of whose it is here. */
export type PaymentTransferDetails = {
  /** The reference its sender is told to quote; null once the provider stops showing it. */
  ownReference: string | null;
  stripeCustomerId: string | null;
  paymentId: string | null;
  paymentGroupId: string | null;
  privateSaleDealId: string | null;
  privateSaleDealPaymentId: string | null;
};

/** The one reading of an intent, for the events that carry it and for the checks that retrieve it. */
export function transferDetailsOf(intent: Stripe.PaymentIntent): PaymentTransferDetails {
  const reference = intent.next_action?.display_bank_transfer_instructions?.reference?.trim();
  const customer = intent.customer;
  return {
    ownReference: reference ? reference : null,
    stripeCustomerId: typeof customer === "string" ? customer : (customer?.id ?? null),
    paymentId: uuidOrNull(intent.metadata?.paymentId),
    paymentGroupId: uuidOrNull(intent.metadata?.paymentGroupId),
    privateSaleDealId: uuidOrNull(intent.metadata?.privateSaleDealId),
    privateSaleDealPaymentId: uuidOrNull(intent.metadata?.privateSaleDealPaymentId),
  };
}
