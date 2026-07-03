import { CheckoutSessionAsyncPaymentFailedHandler } from "./checkout-session-async-payment-failed.handler.js";
import type { ICheckoutSessionWebhookHandler } from "./checkout-session-webhook-handler.js";
import { PaymentIntentCanceledHandler } from "./payment-intent-canceled.handler.js";
import { PaymentIntentFailedHandler } from "./payment-intent-failed.handler.js";
import { PaymentIntentPartiallyFundedHandler } from "./payment-intent-partially-funded.handler.js";
import { PaymentIntentProcessingHandler } from "./payment-intent-processing.handler.js";
import { PaymentIntentSucceededHandler } from "./payment-intent-succeeded.handler.js";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { StripePaymentWebhookDeps } from "./payment-webhook-lookup.js";

export type PaymentWebhookHandlers = {
  paymentIntentSucceeded: IPaymentIntentWebhookHandler;
  paymentIntentProcessing: IPaymentIntentWebhookHandler;
  paymentIntentPartiallyFunded: IPaymentIntentWebhookHandler;
  paymentIntentFailed: IPaymentIntentWebhookHandler;
  paymentIntentCanceled: IPaymentIntentWebhookHandler;
  checkoutSessionAsyncPaymentFailed: ICheckoutSessionWebhookHandler;
};

export function createPaymentWebhookHandlers(
  deps: StripePaymentWebhookDeps,
): PaymentWebhookHandlers {
  return {
    paymentIntentSucceeded: new PaymentIntentSucceededHandler(deps),
    paymentIntentProcessing: new PaymentIntentProcessingHandler(deps),
    paymentIntentPartiallyFunded: new PaymentIntentPartiallyFundedHandler(deps),
    paymentIntentFailed: new PaymentIntentFailedHandler(deps),
    paymentIntentCanceled: new PaymentIntentCanceledHandler(deps),
    checkoutSessionAsyncPaymentFailed: new CheckoutSessionAsyncPaymentFailedHandler(deps),
  };
}
