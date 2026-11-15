import type { IPaymentGroupRepository, ITransactionRunner } from "@auction/persistence/interfaces";
import { type StaffRoles, type UserRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { AuthzError, PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import { paymentProviderErrorFromUnknown } from "../payment/payment-service-errors.js";
import type { IChargeRefundsReader } from "../stripe/stripe-charge-refunds.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import {
  isCountedRefund,
  isReturnedNothing,
  isUnsettledRefund,
} from "../stripe/stripe-refund-status.js";

/** The audit event a staff courier refund writes, with who asked, why, and what Stripe said. */
export const DELIVERY_REFUND_REQUESTED_EVENT = "payment_group.delivery_refund_requested";

export type RefundDeliveryInput = {
  actorUserId: string;
  role: string;
  staffRoles: StaffRoles | undefined;
  paymentGroupId: string;
  deliveryQuoteId: string;
  /** Pence to return; the rest of the courier charge when absent. */
  amountPence?: number;
  /** Why the courier charge goes back; kept on the audit event. */
  reason: string;
};

export type RefundDeliveryOutcome = {
  stripeRefundId: string;
  /** Stripe's status: `succeeded`, or `pending` while the money is on its way back. */
  status: string;
  amountPence: number;
};

export interface IPaymentGroupDeliveryRefunds {
  refundDelivery(
    input: RefundDeliveryInput,
  ): Promise<Result<RefundDeliveryOutcome, AuthzError | PaymentProviderError>>;
}

export type PaymentGroupDeliveryRefundDeps = {
  transactionRunner: ITransactionRunner;
  groups: Pick<IPaymentGroupRepository, "lockInTransaction">;
  stripe: Pick<IStripePaymentGateway, "isConfigured" | "createRefund">;
  /** Every refund Stripe holds on the charge, whatever its status. */
  chargeRefunds: Pick<IChargeRefundsReader, "listChargeRefunds">;
  events: IDomainEventSink;
};

/**
 * A staff refund of the courier part of a combined ("Pay several") payment, on its own.
 *
 * The refund is made against the group's charge with `metadata.deliveryQuoteId`, so the refund
 * webhook (`PaymentGroupChargeEvents`) attributes it to the quote and never to an invoice: no
 * seller's payout is clawed back and no invoice's refunded amount moves. Nothing is written to a
 * ledger here; the webhook raises the quote's refunded total once Stripe says the money went back,
 * exactly as for a refund made any other way. This call writes only the audit event.
 *
 * It refuses to return more than what is left of the courier charge, counting refunds Stripe is
 * still processing, so two staff members (or a retry) cannot refund the courier twice. The Stripe
 * idempotency key names the quote, the amount and what had already gone back, so a repeat of the
 * same request is the same refund.
 */
export class PaymentGroupDeliveryRefundService implements IPaymentGroupDeliveryRefunds {
  constructor(private readonly deps: PaymentGroupDeliveryRefundDeps) {}

  async refundDelivery(
    input: RefundDeliveryInput,
  ): Promise<Result<RefundDeliveryOutcome, AuthzError | PaymentProviderError>> {
    if (!roleHasCapability(input.role as UserRole, "finance.platform.write", input.staffRoles)) {
      return err(new AuthzError("Forbidden", 403));
    }
    if (!this.deps.stripe.isConfigured()) {
      return err(new PaymentProviderError("Stripe is not configured for this environment", 503));
    }
    // Read under the group lock so the figures are the ones the refund webhooks last wrote. The
    // lock is let go before Stripe is called.
    const snapshot = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.deps.groups.lockInTransaction(tx, input.paymentGroupId);
      if (!locked) return null;
      const delivery = locked.deliveries.find((d) => d.quoteId === input.deliveryQuoteId) ?? null;
      return { group: locked.group, delivery };
    });
    if (!snapshot) return err(new AuthzError("Payment not found", 404));
    const { group, delivery } = snapshot;
    if (!delivery) {
      return err(new AuthzError("This payment did not charge that courier quote", 404));
    }
    if (group.status !== "paid" || !group.stripeChargeId) {
      return err(new AuthzError("Only a paid payment's courier charge can be refunded", 409));
    }
    const chargeId = group.stripeChargeId;

    let stripeTaken: number;
    try {
      const refunds = await this.deps.chargeRefunds.listChargeRefunds(chargeId);
      stripeTaken = refunds
        .filter(
          (r) =>
            r.deliveryQuoteId === delivery.quoteId &&
            (isCountedRefund(r.status) || isUnsettledRefund(r.status)),
        )
        .reduce((sum, r) => sum + r.amountPence, 0);
    } catch (e) {
      return err(paymentProviderErrorFromUnknown(e));
    }
    const chargedPence = gbpAmountToPence(delivery.amount);
    const alreadyBackPence = Math.max(delivery.refundedPence, stripeTaken);
    const remainingPence = chargedPence - alreadyBackPence;
    if (remainingPence <= 0) {
      return err(new AuthzError("The courier charge has already been refunded", 409));
    }
    const amountPence = input.amountPence ?? remainingPence;
    if (!Number.isInteger(amountPence) || amountPence <= 0 || amountPence > remainingPence) {
      return err(
        new AuthzError(
          `Enter an amount up to £${(remainingPence / 100).toFixed(2)}, what is left of the courier charge`,
          400,
        ),
      );
    }

    let outcome: Awaited<ReturnType<IStripePaymentGateway["createRefund"]>>;
    try {
      outcome = await this.deps.stripe.createRefund({
        chargeId,
        amount: amountPence,
        reason: "requested_by_customer",
        deliveryQuoteId: delivery.quoteId,
        sequence: alreadyBackPence,
      });
    } catch (e) {
      return err(paymentProviderErrorFromUnknown(e));
    }
    if (outcome.kind === "already_refunded") {
      recordMoneyPathEvent("delivery_refund_charge_already_refunded");
      return err(new AuthzError("The payment has already been refunded in full", 409));
    }
    if (isReturnedNothing(outcome.status)) {
      recordMoneyPathEvent("delivery_refund_not_made");
      return err(
        new PaymentProviderError(`Stripe did not make the refund (${outcome.status})`, 502),
      );
    }
    recordMoneyPathEvent("delivery_refund_requested");
    await this.deps.events.publish({
      aggregateType: "payment_group",
      aggregateId: group.id,
      eventType: DELIVERY_REFUND_REQUESTED_EVENT,
      payload: {
        paymentGroupId: group.id,
        deliveryQuoteId: delivery.quoteId,
        stripeChargeId: chargeId,
        stripeRefundId: outcome.refundId,
        refundStatus: outcome.status,
        amountCents: outcome.amountPence,
        chargedCents: chargedPence,
        currency: group.currency,
        staffReason: input.reason,
      },
      actorUserId: input.actorUserId,
      actingLegalEntityId: group.buyerLegalEntityId,
    });
    return ok({
      stripeRefundId: outcome.refundId,
      status: outcome.status,
      amountPence: outcome.amountPence,
    });
  }
}
