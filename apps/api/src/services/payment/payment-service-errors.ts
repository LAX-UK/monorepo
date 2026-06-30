import Stripe from "stripe";
import { PaymentProviderError } from "../../lib/errors.js";

export function paymentProviderErrorFromUnknown(e: unknown): PaymentProviderError {
  if (e instanceof Stripe.errors.StripeError) {
    const status =
      e.type === "StripeInvalidRequestError" || e.type === "StripeCardError" ? 400 : 502;
    return new PaymentProviderError(e.message, status, e.code ?? undefined);
  }
  if (e instanceof Error) {
    return new PaymentProviderError(e.message, 502);
  }
  return new PaymentProviderError("Payment provider error", 502);
}
