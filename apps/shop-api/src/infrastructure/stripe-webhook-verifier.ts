import Stripe from "stripe";

export function constructStripeWebhookEvent(
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
): Stripe.Event {
  return Stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}
