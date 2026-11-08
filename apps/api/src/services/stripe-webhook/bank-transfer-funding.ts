import type Stripe from "stripe";

/**
 * What a bank transfer into a payment has delivered, read the one way for a single invoice and a
 * combined payment. Stripe's own statement of what is still to send is the authority when it is
 * there: received is the amount less that. Without it, the intent's `amount_received` is used.
 */
export function transferFunding(paymentIntent: Stripe.PaymentIntent): {
  remainingPence: number;
  receivedPence: number;
} {
  const shown = paymentIntent.next_action?.display_bank_transfer_instructions?.amount_remaining;
  if (shown !== null && shown !== undefined) {
    return {
      remainingPence: shown,
      receivedPence: Math.max(0, paymentIntent.amount - shown),
    };
  }
  const received = paymentIntent.amount_received ?? 0;
  return {
    remainingPence: Math.max(0, paymentIntent.amount - received),
    receivedPence: received,
  };
}
