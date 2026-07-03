import type Stripe from "stripe";
import type { PaymentWebhookResult } from "./payment-webhook-types.js";

export interface ICheckoutSessionWebhookHandler {
  handle(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<PaymentWebhookResult>;
}
