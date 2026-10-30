import type {
  IPaymentGroupRepository,
  IPaymentReadRepository,
} from "@auction/persistence/interfaces";
import type { PaymentGroupChargeEvents } from "../payment-group/payment-group-charge-events.js";
import type { IPaymentGroupGateway } from "../payment-group/payment-group-ports.js";
import type { PaymentGroupSettlementService } from "../payment-group/payment-group-settlement.service.js";
import { CheckoutSessionAsyncPaymentFailedHandler } from "./checkout-session-async-payment-failed.handler.js";
import type { ICheckoutSessionWebhookHandler } from "./checkout-session-webhook-handler.js";
import {
  GroupAwareCheckoutSessionHandler,
  GroupAwarePaymentIntentHandler,
  GroupPaymentAttemptFailedHandler,
  GroupPaymentProcessingHandler,
  GroupPaymentReleasedHandler,
  GroupPaymentSucceededHandler,
  IGNORED_SINGLE_SESSION_EVENT,
  SingleInvoiceInGroupCancelGuard,
  SingleInvoicePaidInGroupGuard,
} from "./payment-group-webhook-handlers.js";
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
  checkoutSessionExpired: ICheckoutSessionWebhookHandler;
};

/** What "Pay several" adds to the payment webhooks: a group's settlement and charge events. */
export type PaymentGroupWebhookDeps = {
  settlement: Pick<PaymentGroupSettlementService, "settle" | "markProcessing" | "release">;
  chargeEvents: Pick<PaymentGroupChargeEvents, "chargeRefunded" | "dispute">;
  groups: Pick<IPaymentGroupRepository, "findById">;
  payments: Pick<IPaymentReadRepository, "findById">;
  gateway: Pick<IPaymentGroupGateway, "expireCheckout">;
};

function singleInvoiceHandlers(deps: StripePaymentWebhookDeps): PaymentWebhookHandlers {
  return {
    paymentIntentSucceeded: new PaymentIntentSucceededHandler(deps),
    paymentIntentProcessing: new PaymentIntentProcessingHandler(deps),
    paymentIntentPartiallyFunded: new PaymentIntentPartiallyFundedHandler(deps),
    paymentIntentFailed: new PaymentIntentFailedHandler(deps),
    paymentIntentCanceled: new PaymentIntentCanceledHandler(deps),
    checkoutSessionAsyncPaymentFailed: new CheckoutSessionAsyncPaymentFailedHandler(deps),
    checkoutSessionExpired: IGNORED_SINGLE_SESSION_EVENT,
  };
}

/**
 * Each payment webhook's handler. With "Pay several" wired in, every event is routed by the
 * metadata its checkout set: a group's events go to the group handlers, everything else to the
 * single-invoice handlers exactly as before.
 */
export function createPaymentWebhookHandlers(
  deps: StripePaymentWebhookDeps,
  groups: PaymentGroupWebhookDeps | null = null,
): PaymentWebhookHandlers {
  const single = singleInvoiceHandlers(deps);
  if (!groups) return single;
  const { settlement } = groups;
  const processing = new GroupPaymentProcessingHandler(settlement);
  return {
    paymentIntentSucceeded: new GroupAwarePaymentIntentHandler(
      new SingleInvoicePaidInGroupGuard(single.paymentIntentSucceeded, groups),
      new GroupPaymentSucceededHandler(settlement),
    ),
    paymentIntentProcessing: new GroupAwarePaymentIntentHandler(
      single.paymentIntentProcessing,
      processing,
    ),
    paymentIntentPartiallyFunded: new GroupAwarePaymentIntentHandler(
      single.paymentIntentPartiallyFunded,
      processing,
    ),
    paymentIntentFailed: new GroupAwarePaymentIntentHandler(
      single.paymentIntentFailed,
      new GroupPaymentAttemptFailedHandler(),
    ),
    paymentIntentCanceled: new GroupAwarePaymentIntentHandler(
      new SingleInvoiceInGroupCancelGuard(single.paymentIntentCanceled, groups.payments),
      new GroupPaymentReleasedHandler(settlement, "checkout_cancelled"),
    ),
    checkoutSessionAsyncPaymentFailed: new GroupAwareCheckoutSessionHandler(
      new SingleInvoiceInGroupCancelGuard(
        single.checkoutSessionAsyncPaymentFailed,
        groups.payments,
      ),
      new GroupPaymentReleasedHandler(settlement, "bank_transfer_failed"),
    ),
    checkoutSessionExpired: new GroupAwareCheckoutSessionHandler(
      single.checkoutSessionExpired,
      new GroupPaymentReleasedHandler(settlement, "checkout_expired"),
    ),
  };
}
