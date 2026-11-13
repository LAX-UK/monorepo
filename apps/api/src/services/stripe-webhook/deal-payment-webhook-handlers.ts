import type { IPrivateSaleDealPaymentReader } from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import type {
  DealPaymentCancelReason,
  DealPaymentSettlementService,
} from "../private-sale-deal/deal-payment-settlement.service.js";
import { chargeIdFromPaymentIntent } from "../stripe/stripe-charge-id.js";
import type { IChargeRefundsReader } from "../stripe/stripe-charge-refunds.js";
import { chargeRefundTotals, isCountedRefund } from "../stripe/stripe-refund-status.js";
import type { ICheckoutSessionWebhookHandler } from "./checkout-session-webhook-handler.js";
import type { PaymentWebhookHandlers } from "./create-payment-webhook-handlers.js";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { PaymentWebhookResult } from "./payment-webhook-types.js";

type Settlement = Pick<
  DealPaymentSettlementService,
  "settle" | "markProcessing" | "cancel" | "refunded"
>;

/** What the deal payment webhooks need to settle a deal's payment. */
export type DealPaymentWebhookDeps = {
  settlement: Settlement;
  payments: Pick<IPrivateSaleDealPaymentReader, "findByChargeId">;
};

/** The deal payment a provider object belongs to, from the metadata its checkout set. */
export function dealPaymentIdOf(object: { metadata?: Stripe.Metadata | null }): string | null {
  return object.metadata?.privateSaleDealPaymentId ?? null;
}

class DealPaymentSucceededHandler implements IPaymentIntentWebhookHandler {
  constructor(private readonly settlement: Settlement) {}

  handle(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<PaymentWebhookResult> {
    return this.settlement.settle({
      eventId: event.id,
      paymentId: dealPaymentIdOf(paymentIntent) as string,
      paymentIntentId: paymentIntent.id,
      chargeId: chargeIdFromPaymentIntent(paymentIntent),
      amountMinor: paymentIntent.amount,
    });
  }
}

/** A bank transfer for the deal started, or arrived in part: the payment waits for the rest. */
class DealPaymentProcessingHandler implements IPaymentIntentWebhookHandler {
  constructor(private readonly settlement: Settlement) {}

  handle(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<PaymentWebhookResult> {
    return this.settlement.markProcessing({
      eventId: event.id,
      paymentId: dealPaymentIdOf(paymentIntent) as string,
    });
  }
}

/** A failed attempt leaves the checkout open for another try, so nothing changes. */
class DealPaymentAttemptFailedHandler implements IPaymentIntentWebhookHandler {
  async handle(): Promise<PaymentWebhookResult> {
    return { processed: true, action: "payment_intent_failed" };
  }
}

class DealPaymentReleasedHandler
  implements IPaymentIntentWebhookHandler, ICheckoutSessionWebhookHandler
{
  constructor(
    private readonly settlement: Settlement,
    private readonly reason: DealPaymentCancelReason,
  ) {}

  handle(
    event: Stripe.Event,
    object: Stripe.PaymentIntent | Stripe.Checkout.Session,
  ): Promise<PaymentWebhookResult> {
    return this.settlement.cancel({
      eventId: event.id,
      paymentId: dealPaymentIdOf(object) as string,
      reason: this.reason,
    });
  }
}

class DealAwarePaymentIntentHandler implements IPaymentIntentWebhookHandler {
  constructor(
    private readonly next: IPaymentIntentWebhookHandler,
    private readonly deal: IPaymentIntentWebhookHandler,
  ) {}

  handle(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<PaymentWebhookResult> {
    return dealPaymentIdOf(paymentIntent)
      ? this.deal.handle(event, paymentIntent)
      : this.next.handle(event, paymentIntent);
  }
}

class DealAwareCheckoutSessionHandler implements ICheckoutSessionWebhookHandler {
  constructor(
    private readonly next: ICheckoutSessionWebhookHandler,
    private readonly deal: ICheckoutSessionWebhookHandler,
  ) {}

  handle(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<PaymentWebhookResult> {
    return dealPaymentIdOf(session)
      ? this.deal.handle(event, session)
      : this.next.handle(event, session);
  }
}

/**
 * Routes each payment event by the metadata its checkout set: a deal's events go to the deal
 * handlers, everything else to the handlers it was given, exactly as before.
 */
export function withDealPaymentHandlers(
  handlers: PaymentWebhookHandlers,
  deals: DealPaymentWebhookDeps,
): PaymentWebhookHandlers {
  const { settlement } = deals;
  return {
    paymentIntentSucceeded: new DealAwarePaymentIntentHandler(
      handlers.paymentIntentSucceeded,
      new DealPaymentSucceededHandler(settlement),
    ),
    paymentIntentProcessing: new DealAwarePaymentIntentHandler(
      handlers.paymentIntentProcessing,
      new DealPaymentProcessingHandler(settlement),
    ),
    paymentIntentPartiallyFunded: new DealAwarePaymentIntentHandler(
      handlers.paymentIntentPartiallyFunded,
      new DealPaymentProcessingHandler(settlement),
    ),
    paymentIntentFailed: new DealAwarePaymentIntentHandler(
      handlers.paymentIntentFailed,
      new DealPaymentAttemptFailedHandler(),
    ),
    paymentIntentCanceled: new DealAwarePaymentIntentHandler(
      handlers.paymentIntentCanceled,
      new DealPaymentReleasedHandler(settlement, "checkout_cancelled"),
    ),
    checkoutSessionAsyncPaymentFailed: new DealAwareCheckoutSessionHandler(
      handlers.checkoutSessionAsyncPaymentFailed,
      new DealPaymentReleasedHandler(settlement, "bank_transfer_failed"),
    ),
    checkoutSessionExpired: new DealAwareCheckoutSessionHandler(
      handlers.checkoutSessionExpired,
      new DealPaymentReleasedHandler(settlement, "checkout_expired"),
    ),
  };
}

/**
 * A refund made on a deal's charge, in the payment provider, is recorded on the deal payment. Only
 * refunds Stripe reports succeeded count; a pending one is watched and recorded once it succeeds.
 */
export async function dealChargeRefunded(
  deals: DealPaymentWebhookDeps,
  event: Stripe.Event,
  charge: Stripe.Charge,
  chargeRefunds: Pick<IChargeRefundsReader, "listChargeRefunds">,
): Promise<PaymentWebhookResult | null> {
  if (!(await deals.payments.findByChargeId(charge.id))) return null;
  const refunds = await chargeRefunds.listChargeRefunds(charge.id);
  return deals.settlement.refunded({
    eventId: event.id,
    chargeId: charge.id,
    refundedMinor: chargeRefundTotals(refunds).countedPence,
    refundId: refunds.find((r) => isCountedRefund(r.status))?.id ?? null,
  });
}
