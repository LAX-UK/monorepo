import type {
  IPaymentGroupRepository,
  IPaymentReadRepository,
} from "@auction/persistence/interfaces";
import type Stripe from "stripe";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IPaymentGroupGateway } from "../payment-group/payment-group-ports.js";
import type {
  PaymentGroupReleaseReason,
  PaymentGroupSettlementService,
} from "../payment-group/payment-group-settlement.service.js";
import { chargeIdFromPaymentIntent } from "../stripe/stripe-charge-id.js";
import type { ICheckoutSessionWebhookHandler } from "./checkout-session-webhook-handler.js";
import type { IPaymentIntentWebhookHandler } from "./payment-intent-webhook-handler.js";
import type { PaymentWebhookResult } from "./payment-webhook-types.js";

type Settlement = Pick<PaymentGroupSettlementService, "settle" | "markProcessing" | "release">;

/** The "Pay several" group a provider object belongs to, from the metadata the checkout set. */
export function paymentGroupIdOf(object: { metadata?: Stripe.Metadata | null }): string | null {
  return object.metadata?.paymentGroupId ?? null;
}

/**
 * Sends a PaymentIntent event to the group handler when the intent pays a "Pay several" group,
 * and to the single-invoice handler otherwise. Single-invoice handling is untouched.
 */
export class GroupAwarePaymentIntentHandler implements IPaymentIntentWebhookHandler {
  constructor(
    private readonly single: IPaymentIntentWebhookHandler,
    private readonly group: IPaymentIntentWebhookHandler,
  ) {}

  handle(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<PaymentWebhookResult> {
    return paymentGroupIdOf(paymentIntent)
      ? this.group.handle(event, paymentIntent)
      : this.single.handle(event, paymentIntent);
  }
}

/** The same routing for Checkout Session events. */
export class GroupAwareCheckoutSessionHandler implements ICheckoutSessionWebhookHandler {
  constructor(
    private readonly single: ICheckoutSessionWebhookHandler,
    private readonly group: ICheckoutSessionWebhookHandler,
  ) {}

  handle(event: Stripe.Event, session: Stripe.Checkout.Session): Promise<PaymentWebhookResult> {
    return paymentGroupIdOf(session)
      ? this.group.handle(event, session)
      : this.single.handle(event, session);
  }
}

/** The group's money arrived: every invoice in it is settled at once. */
export class GroupPaymentSucceededHandler implements IPaymentIntentWebhookHandler {
  constructor(private readonly settlement: Settlement) {}

  handle(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<PaymentWebhookResult> {
    return this.settlement.settle({
      eventId: event.id,
      groupId: paymentGroupIdOf(paymentIntent) as string,
      paymentIntentId: paymentIntent.id,
      chargeId: chargeIdFromPaymentIntent(paymentIntent),
      amountPence: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  }
}

/** A bank transfer for the group started (or arrived in part): its invoices are held. */
export class GroupPaymentProcessingHandler implements IPaymentIntentWebhookHandler {
  constructor(private readonly settlement: Settlement) {}

  handle(event: Stripe.Event, paymentIntent: Stripe.PaymentIntent): Promise<PaymentWebhookResult> {
    return this.settlement.markProcessing({
      eventId: event.id,
      groupId: paymentGroupIdOf(paymentIntent) as string,
    });
  }
}

/**
 * A payment attempt failed (a declined card). The checkout stays open for another try, so the
 * group keeps its invoices; nothing changes.
 */
export class GroupPaymentAttemptFailedHandler implements IPaymentIntentWebhookHandler {
  async handle(): Promise<PaymentWebhookResult> {
    recordMoneyPathEvent("payment_group_attempt_failed");
    return { processed: true, action: "skipped", reason: "payment_group_attempt_failed" };
  }
}

/** The group's checkout ended unpaid (cancelled, expired or failed): its invoices go back. */
export class GroupPaymentReleasedHandler
  implements IPaymentIntentWebhookHandler, ICheckoutSessionWebhookHandler
{
  constructor(
    private readonly settlement: Settlement,
    private readonly reason: PaymentGroupReleaseReason,
  ) {}

  handle(
    event: Stripe.Event,
    object: Stripe.PaymentIntent | Stripe.Checkout.Session,
  ): Promise<PaymentWebhookResult> {
    return this.settlement.release({
      eventId: event.id,
      groupId: paymentGroupIdOf(object) as string,
      reason: this.reason,
    });
  }
}

/** Checkout Session events with no single-invoice meaning (an expired session). */
export const IGNORED_SINGLE_SESSION_EVENT: ICheckoutSessionWebhookHandler = {
  handle: async () => ({ processed: true, action: "skipped", reason: "not_a_payment_group" }),
};

/**
 * Wraps the single-invoice handlers that cancel a payment when its own checkout ends. Once an
 * invoice joins a "Pay several" group, its earlier checkout is closed on purpose; that must not
 * cancel the invoice the group is about to settle, so the event is let pass.
 */
export class SingleInvoiceInGroupCancelGuard<
  T extends Stripe.PaymentIntent | Stripe.Checkout.Session,
> {
  constructor(
    private readonly single: {
      handle(event: Stripe.Event, object: T): Promise<PaymentWebhookResult>;
    },
    private readonly payments: Pick<IPaymentReadRepository, "findById">,
  ) {}

  async handle(event: Stripe.Event, object: T): Promise<PaymentWebhookResult> {
    const paymentId = object.metadata?.paymentId;
    const payment = paymentId ? await this.payments.findById(paymentId) : null;
    if (payment?.paymentGroupId) {
      return { processed: true, action: "skipped", reason: "payment_in_group" };
    }
    return this.single.handle(event, object);
  }
}

/**
 * Wraps the single-invoice success handler: when an invoice that sits in a "Pay several" group is
 * paid on its own (an earlier checkout completed after the group took it), the group is let go so
 * its checkout cannot take the same money again; when the group was already paid, the double
 * payment is flagged for the finance team to refund.
 */
export class SingleInvoicePaidInGroupGuard implements IPaymentIntentWebhookHandler {
  constructor(
    private readonly single: IPaymentIntentWebhookHandler,
    private readonly deps: {
      payments: Pick<IPaymentReadRepository, "findById">;
      groups: Pick<IPaymentGroupRepository, "findById">;
      gateway: Pick<IPaymentGroupGateway, "expireCheckout">;
      settlement: Pick<Settlement, "release">;
    },
  ) {}

  async handle(
    event: Stripe.Event,
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<PaymentWebhookResult> {
    const result = await this.single.handle(event, paymentIntent);
    const paymentId = paymentIntent.metadata?.paymentId;
    if (!paymentId) return result;
    const payment = await this.deps.payments.findById(paymentId);
    if (!payment?.paymentGroupId) return result;
    const group = await this.deps.groups.findById(payment.paymentGroupId);
    if (!group) return result;
    if (group.status === "open" || group.status === "processing") {
      if (group.stripeCheckoutSessionId) {
        await this.deps.gateway.expireCheckout(group.stripeCheckoutSessionId);
      }
      await this.deps.settlement.release({
        eventId: null,
        groupId: group.id,
        reason: "invoice_paid_separately",
      });
    } else if (group.status === "paid" && group.stripePaymentIntentId !== paymentIntent.id) {
      recordMoneyPathEvent("payment_group_invoice_paid_twice");
      console.error(
        JSON.stringify({
          msg: "payment_group_invoice_paid_twice",
          paymentId,
          paymentGroupId: group.id,
          stripePaymentIntentId: paymentIntent.id,
        }),
      );
    }
    return result;
  }
}
