import type {
  IPaymentWebhookLookupReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import type { IPayoutRepository } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type { IDomainEventSink } from "./domain-event-sink.js";
import type { IPaymentCaptureService } from "./interfaces/payment-capture.js";
import type { IPayoutAdjustmentService } from "./interfaces/payout-adjustment.js";
import { handleChargeRefunded } from "./stripe-webhook/checkout-refund-handlers.js";
import { createPaymentWebhookHandlers } from "./stripe-webhook/create-payment-webhook-handlers.js";
import {
  handleDisputeClosed,
  handleDisputeCreated,
  handleDisputeFundsWithdrawn,
} from "./stripe-webhook/dispute-handlers.js";
import type { StripePaymentWebhookDeps } from "./stripe-webhook/payment-webhook-lookup.js";
import type { PaymentWebhookResult } from "./stripe-webhook/payment-webhook-types.js";

export type { PaymentWebhookResult } from "./stripe-webhook/payment-webhook-types.js";

/** Routes Stripe payment webhooks to segregated handlers (no business logic). */
export class StripePaymentWebhookService {
  private readonly deps: StripePaymentWebhookDeps;
  private readonly handlers: ReturnType<typeof createPaymentWebhookHandlers>;

  constructor(
    transactionRunner: ITransactionRunner,
    paymentWebhookLookup: IPaymentWebhookLookupReader,
    payments: IPaymentWriteRepository,
    payoutRepository: IPayoutRepository,
    payoutAdjustments: IPayoutAdjustmentService,
    paymentCapture: IPaymentCaptureService,
    domainEventSink: IDomainEventSink,
  ) {
    this.deps = {
      transactionRunner,
      paymentWebhookLookup,
      payments,
      payoutRepository,
      payoutAdjustments,
      paymentCapture,
      domainEventSink,
    };
    this.handlers = createPaymentWebhookHandlers(this.deps);
  }

  async handlePaymentIntentSucceeded(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentSucceeded.handle(event, paymentIntent);
  }

  async handlePaymentIntentProcessing(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentProcessing.handle(event, paymentIntent);
  }

  async handlePaymentIntentPartiallyFunded(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentPartiallyFunded.handle(event, paymentIntent);
  }

  async handlePaymentIntentFailed(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentFailed.handle(event, paymentIntent);
  }

  async handlePaymentIntentCanceled(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.paymentIntentCanceled.handle(event, paymentIntent);
  }

  async handleCheckoutSessionAsyncPaymentFailed(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ): Promise<PaymentWebhookResult> {
    return this.handlers.checkoutSessionAsyncPaymentFailed.handle(event, session);
  }

  async handleDisputeCreated(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return handleDisputeCreated(this.deps, event, dispute);
  }

  async handleDisputeFundsWithdrawn(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return handleDisputeFundsWithdrawn(this.deps, event, dispute);
  }

  async handleDisputeClosed(
    event: Stripe.Event,
    dispute: Stripe.Dispute,
  ): Promise<PaymentWebhookResult> {
    return handleDisputeClosed(this.deps, event, dispute);
  }

  async handleChargeRefunded(
    event: Stripe.Event,
    charge: Stripe.Charge,
  ): Promise<PaymentWebhookResult> {
    return handleChargeRefunded(this.deps, event, charge);
  }
}
