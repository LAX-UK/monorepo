import type Stripe from "stripe";
import type { PaymentWebhookResult } from "./payment-webhook-types.js";

export interface IPaymentIntentWebhookHandler {
  handle(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<PaymentWebhookResult>;
}
