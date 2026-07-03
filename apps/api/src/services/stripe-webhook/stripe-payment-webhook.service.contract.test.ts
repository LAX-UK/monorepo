import { describe, expect, it } from "vitest";
import { defineCompileTimeContract } from "../../testing/compile-time-contract.js";
import type { StripePaymentWebhookService } from "../stripe-payment-webhook.service.js";
import type { CheckoutSessionAsyncPaymentFailedHandler } from "../stripe-webhook/checkout-session-async-payment-failed.handler.js";
import type { ICheckoutSessionWebhookHandler } from "../stripe-webhook/checkout-session-webhook-handler.js";
import type { PaymentIntentCanceledHandler } from "../stripe-webhook/payment-intent-canceled.handler.js";
import type { PaymentIntentFailedHandler } from "../stripe-webhook/payment-intent-failed.handler.js";
import type { PaymentIntentPartiallyFundedHandler } from "../stripe-webhook/payment-intent-partially-funded.handler.js";
import type { PaymentIntentProcessingHandler } from "../stripe-webhook/payment-intent-processing.handler.js";
import type { PaymentIntentSucceededHandler } from "../stripe-webhook/payment-intent-succeeded.handler.js";
import type { IPaymentIntentWebhookHandler } from "../stripe-webhook/payment-intent-webhook-handler.js";

/**
 * Compile-time LSP contract: PI/checkout webhook handlers must implement segregated interfaces.
 */
type AssertAssignable<T extends U, U> = T;

declare const succeeded: PaymentIntentSucceededHandler;
declare const processing: PaymentIntentProcessingHandler;
declare const partiallyFunded: PaymentIntentPartiallyFundedHandler;
declare const failed: PaymentIntentFailedHandler;
declare const canceled: PaymentIntentCanceledHandler;
declare const asyncPaymentFailed: CheckoutSessionAsyncPaymentFailedHandler;
declare const webhookService: StripePaymentWebhookService;

type _Succeeded = AssertAssignable<typeof succeeded, IPaymentIntentWebhookHandler>;
type _Processing = AssertAssignable<typeof processing, IPaymentIntentWebhookHandler>;
type _PartiallyFunded = AssertAssignable<typeof partiallyFunded, IPaymentIntentWebhookHandler>;
type _Failed = AssertAssignable<typeof failed, IPaymentIntentWebhookHandler>;
type _Canceled = AssertAssignable<typeof canceled, IPaymentIntentWebhookHandler>;
type _AsyncFailed = AssertAssignable<typeof asyncPaymentFailed, ICheckoutSessionWebhookHandler>;

type _HasSucceeded = AssertAssignable<
  (typeof webhookService)["handlePaymentIntentSucceeded"],
  StripePaymentWebhookService["handlePaymentIntentSucceeded"]
>;

type _HandlerContract = [
  _Succeeded,
  _Processing,
  _PartiallyFunded,
  _Failed,
  _Canceled,
  _AsyncFailed,
  _HasSucceeded,
];

defineCompileTimeContract<_HandlerContract>();

describe("Stripe payment webhook handler contract", () => {
  it("compile-time LSP types are exported for CI typecheck", () => {
    expect(true).toBe(true);
  });
});
