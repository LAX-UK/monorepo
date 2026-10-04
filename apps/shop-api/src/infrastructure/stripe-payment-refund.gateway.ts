import Stripe from "stripe";
import type {
  PaymentRefundGateway,
  SubmitRefundCommand,
  SubmitRefundResult,
} from "../application/ports/payment-refund.gateway.js";

export function createStripePaymentRefundGateway(input: {
  secretKey: string | undefined;
}): PaymentRefundGateway {
  const stripe = input.secretKey !== undefined ? new Stripe(input.secretKey) : null;

  return {
    async submitRefund(command: SubmitRefundCommand): Promise<SubmitRefundResult> {
      if (!stripe) {
        return { ok: false, retryable: false, message: "Stripe is not configured" };
      }
      try {
        const refund = await stripe.refunds.create(
          {
            payment_intent: command.paymentIntentId,
            amount: command.amountPence,
            metadata: { app: "shop", shop_refund_id: command.refundId },
          },
          { idempotencyKey: command.idempotencyKey },
        );
        return { ok: true, stripeRefundId: refund.id };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stripe refund failed";
        const retryable =
          err instanceof Stripe.errors.StripeConnectionError ||
          err instanceof Stripe.errors.StripeRateLimitError;
        return { ok: false, retryable, message };
      }
    },
  };
}
