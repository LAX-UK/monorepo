import type Stripe from "stripe";

/** Extract charge id from a PaymentIntent `latest_charge` field. */
export function chargeIdFromPaymentIntent(paymentIntent: Stripe.PaymentIntent): string | null {
  const lc = paymentIntent.latest_charge;
  if (typeof lc === "string") return lc;
  if (lc && typeof lc === "object" && "id" in lc) return lc.id;
  return null;
}
