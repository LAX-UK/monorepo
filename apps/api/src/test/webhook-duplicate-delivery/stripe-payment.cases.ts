import type Stripe from "stripe";
import { vi } from "vitest";
import { CheckoutSessionAsyncPaymentFailedHandler } from "../../services/stripe-webhook/checkout-session-async-payment-failed.handler.js";
import { handleCustomerBalanceFundsAvailable } from "../../services/stripe-webhook/customer-balance-unapplied.handler.js";
import { PaymentIntentCanceledHandler } from "../../services/stripe-webhook/payment-intent-canceled.handler.js";
import { PaymentIntentFailedHandler } from "../../services/stripe-webhook/payment-intent-failed.handler.js";
import { PaymentIntentPartiallyFundedHandler } from "../../services/stripe-webhook/payment-intent-partially-funded.handler.js";
import { PaymentIntentProcessingHandler } from "../../services/stripe-webhook/payment-intent-processing.handler.js";
import { PaymentIntentSucceededHandler } from "../../services/stripe-webhook/payment-intent-succeeded.handler.js";
import type { StripePaymentWebhookDeps } from "../../services/stripe-webhook/payment-webhook-lookup.js";
import { UnappliedMoneyRefundHandler } from "../../services/stripe-webhook/unapplied-money-refund.handler.js";
import { succeededRefunds } from "../fake-charge-refunds.js";
import {
  type DeliveryCase,
  duplicateEventResult,
  eventSink,
  stripeEvent,
  stub,
} from "./support.js";

const PAYMENT_ID = "pay_duplicate_delivery";
const paymentRow = {
  id: PAYMENT_ID,
  amount: "10.00",
  status: "pending",
  lotId: "lot_1",
  paidByUserId: null,
  buyerId: null,
  buyerLegalEntityId: null,
};
const paymentIntent = (extra: Record<string, unknown> = {}) =>
  ({
    id: "pi_duplicate_delivery",
    amount: 1000,
    amount_received: 0,
    currency: "gbp",
    latest_charge: "ch_duplicate_delivery",
    metadata: { paymentId: PAYMENT_ID },
    ...extra,
  }) as unknown as Stripe.PaymentIntent;

/** A payment-intent handler, whose effect is `effectMethod` on the payments store. */
function paymentIntentCase(
  name: string,
  type: string,
  makeHandler: (deps: StripePaymentWebhookDeps) => {
    handle(event: Stripe.Event, intent: Stripe.PaymentIntent): Promise<unknown>;
  },
  effectMethod: "applyAuthorizedInTransaction" | "applyCancelledInTransaction",
  intent: Stripe.PaymentIntent = paymentIntent(),
): DeliveryCase {
  return {
    name,
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const effect = vi.fn(async () => true);
      const deps = stub<StripePaymentWebhookDeps>({
        transactionRunner: runner,
        payments: stub({ findById: async () => paymentRow, [effectMethod]: effect }),
        domainEventSink: eventSink(),
      });
      const handler = makeHandler(deps);
      const event = stripeEvent(eventId, type, intent);
      return {
        deliver: () => handler.handle(event, intent),
        effect,
        isDuplicate: duplicateEventResult,
      };
    },
  };
}

export const stripePaymentCases: DeliveryCase[] = [
  paymentIntentCase(
    "payment intent processing",
    "payment_intent.processing",
    (deps) => new PaymentIntentProcessingHandler(deps),
    "applyAuthorizedInTransaction",
  ),
  paymentIntentCase(
    "payment intent partially funded",
    "payment_intent.partially_funded",
    (deps) => new PaymentIntentPartiallyFundedHandler(deps),
    "applyAuthorizedInTransaction",
  ),
  paymentIntentCase(
    "payment intent canceled",
    "payment_intent.canceled",
    (deps) => new PaymentIntentCanceledHandler(deps),
    "applyCancelledInTransaction",
  ),
  {
    name: "payment intent failed",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const publish = vi.fn(async () => undefined);
      const deps = stub<StripePaymentWebhookDeps>({
        transactionRunner: runner,
        payments: stub({ findById: async () => paymentRow }),
        domainEventSink: eventSink(publish),
      });
      const intent = paymentIntent();
      return {
        deliver: () =>
          new PaymentIntentFailedHandler(deps).handle(
            stripeEvent(eventId, "payment_intent.payment_failed", intent),
            intent,
          ),
        effect: publish,
        isDuplicate: duplicateEventResult,
      };
    },
  },
  {
    name: "payment intent succeeded",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const capture = vi.fn(async () => ({ captured: true, afterCommit: async () => {} }));
      const deps = stub<StripePaymentWebhookDeps>({
        transactionRunner: runner,
        payments: stub({ findById: async () => paymentRow }),
        paymentCapture: stub({ capture }),
        paymentEligibility: null,
      });
      const intent = paymentIntent();
      return {
        deliver: () =>
          new PaymentIntentSucceededHandler(deps).handle(
            stripeEvent(eventId, "payment_intent.succeeded", intent),
            intent,
          ),
        effect: capture,
        isDuplicate: duplicateEventResult,
      };
    },
  },
  {
    name: "checkout session async payment failed",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const cancelled = vi.fn(async () => true);
      const deps = stub<StripePaymentWebhookDeps>({
        transactionRunner: runner,
        payments: stub({
          findById: async () => paymentRow,
          applyCancelledInTransaction: cancelled,
        }),
        domainEventSink: eventSink(),
      });
      const session = { id: "cs_duplicate_delivery", metadata: { paymentId: PAYMENT_ID } };
      return {
        deliver: () =>
          new CheckoutSessionAsyncPaymentFailedHandler(deps).handle(
            stripeEvent(eventId, "checkout.session.async_payment_failed", session),
            session as unknown as Stripe.Checkout.Session,
          ),
        effect: cancelled,
        isDuplicate: duplicateEventResult,
      };
    },
  },
  {
    name: "refund of money that was never applied",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const resolve = vi.fn(async () => undefined);
      const handler = new UnappliedMoneyRefundHandler({
        transactionRunner: runner,
        reader: {
          isChargeOfPaidInvoice: async () => false,
          wasEverUnapplied: async () => true,
          listOpenByChargeId: async () => [],
        },
        recorder: { resolveRefundedCharge: resolve },
        chargeRefunds: succeededRefunds(100),
      });
      const charge = { id: "ch_duplicate_delivery", amount: 100, amount_refunded: 100 };
      return {
        deliver: () =>
          handler.handle(
            stripeEvent(eventId, "charge.refunded", charge),
            charge as unknown as Stripe.Charge,
          ),
        effect: resolve,
        isDuplicate: (result) => duplicateEventResult(result),
      };
    },
  },
  {
    name: "customer balance left over",
    claimsTable: "processed_stripe_events",
    claimedEventId: (eventId) => eventId,
    build(eventId, runner) {
      const record = vi.fn(async () => undefined);
      const deps = stub<StripePaymentWebhookDeps>({
        transactionRunner: runner,
        unappliedMoney: stub({ record }),
      });
      const balance = { customer: "cus_duplicate_delivery", available: { gbp: 500 } };
      return {
        deliver: () =>
          handleCustomerBalanceFundsAvailable(
            deps,
            stripeEvent(eventId, "cash_balance.funds_available", balance),
            balance as unknown as Stripe.CashBalance,
          ),
        effect: record,
        isDuplicate: duplicateEventResult,
      };
    },
  },
];
