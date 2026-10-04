import Stripe from "stripe";

export function createStripePaymentIntentMetadataFetcher(input: {
  secretKey: string | undefined;
}): ((paymentIntentId: string) => Promise<Stripe.Metadata | null | undefined>) | undefined {
  if (!input.secretKey) {
    return undefined;
  }
  const stripe = new Stripe(input.secretKey, { typescript: true });
  return async (paymentIntentId: string) => {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    return pi.metadata;
  };
}
