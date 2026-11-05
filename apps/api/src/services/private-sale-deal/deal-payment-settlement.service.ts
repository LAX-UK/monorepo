import type { Database } from "@auction/db";
import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  dealPaymentCancelledEvent,
  dealPaymentPaidEvent,
  dealPaymentRefundedEvent,
} from "@auction/domain";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPaymentWriter,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { PrivateSaleDeal, PrivateSaleDealPayment } from "@auction/types";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IProviderEventClaim } from "../payment-group/payment-group-settlement.service.js";
import type { PaymentWebhookResult } from "../stripe-webhook/payment-webhook-types.js";
import type { DealTransitionScope, DealTransitionService } from "./deal-transition.service.js";

export type DealPaymentScope = DealTransitionScope & {
  payments: IPrivateSaleDealPaymentReader & IPrivateSaleDealPaymentWriter;
};

/** Why a deal's checkout was let go before it was paid. */
export type DealPaymentCancelReason =
  | "checkout_cancelled"
  | "checkout_expired"
  | "bank_transfer_failed"
  | "checkout_unavailable";

export type DealPaymentSettlementDeps = {
  transactionRunner: ITransactionRunner;
  /** The reads, writes and events of one transaction. */
  scopeForTx: (tx: Database) => DealPaymentScope;
  transitions: Pick<DealTransitionService, "transition">;
  claims: IProviderEventClaim;
  now?: () => Date;
};

const DUPLICATE: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "duplicate_event",
};
const UNKNOWN: PaymentWebhookResult = {
  processed: false,
  action: "skipped",
  reason: "private_sale_payment_not_found",
};

type DealRef = Pick<PrivateSaleDeal, "id" | "reference">;

/**
 * What the payment provider reports about a deal's checkout, applied once however often it is
 * delivered: the event is claimed inside the same transaction as the change, and every move is
 * made only from the statuses that may make it.
 */
export class DealPaymentSettlementService {
  constructor(private readonly deps: DealPaymentSettlementDeps) {}

  /** The money is in: the payment is paid and the deal moves from invoiced to paid. */
  settle(input: {
    eventId: string;
    paymentId: string;
    paymentIntentId: string | null;
    chargeId: string | null;
    amountMinor: number;
  }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const scope = this.deps.scopeForTx(tx);
      const payment = await scope.payments.findByIdForUpdate(input.paymentId);
      if (!payment) return UNKNOWN;
      if (payment.amountMinor !== input.amountMinor) {
        recordMoneyPathEvent("private_sale_payment_amount_mismatch");
        return { processed: false, action: "skipped", reason: "amount_mismatch" };
      }
      const paid = await scope.payments.markPaid(payment.id, {
        chargeId: input.chargeId,
        paymentIntentId: input.paymentIntentId,
        at: (this.deps.now ?? (() => new Date()))(),
      });
      if (!paid) {
        return { processed: true, action: "skipped", reason: "payment_not_open" };
      }
      const deal = await scope.deals.findById(payment.dealId);
      if (!deal) return UNKNOWN;
      await this.publish(scope, deal, dealPaymentPaidEvent(deal, paid), null, payment);

      const moved = await this.deps.transitions.transition(
        deal.id,
        "mark_paid",
        { actorUserId: null },
        scope,
      );
      if (moved.kind !== "ok") {
        // The money is in but the deal was not waiting for it (cancelled while the checkout was
        // open). The payment stays paid so it can be refunded; nothing is hidden.
        recordMoneyPathEvent("private_sale_payment_deal_not_invoiced");
        return {
          processed: true,
          action: "payment_intent_succeeded",
          reason: "deal_not_invoiced",
        };
      }
      return { processed: true, action: "payment_intent_succeeded" };
    });
  }

  /** A bank transfer is on its way: the deal keeps waiting and the checkout stays open. */
  markProcessing(input: { eventId: string; paymentId: string }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const moved = await this.deps.scopeForTx(tx).payments.markProcessing(input.paymentId);
      return moved
        ? { processed: true, action: "payment_intent_processing" }
        : { processed: true, action: "skipped", reason: "payment_not_open" };
    });
  }

  /** The checkout ended unpaid: the deal is due again and the buyer may start another. */
  cancel(input: {
    eventId: string | null;
    paymentId: string;
    reason: DealPaymentCancelReason;
  }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (input.eventId && !(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const scope = this.deps.scopeForTx(tx);
      const payment = await scope.payments.findByIdForUpdate(input.paymentId);
      if (!payment) return UNKNOWN;
      const cancelled = await scope.payments.markCancelled(payment.id);
      if (!cancelled) return { processed: true, action: "skipped", reason: "payment_not_open" };
      const deal = await scope.deals.findById(payment.dealId);
      if (deal) {
        await this.publish(
          scope,
          deal,
          dealPaymentCancelledEvent(deal, cancelled, input.reason),
          null,
          payment,
        );
      }
      return { processed: true, action: "payment_intent_canceled" };
    });
  }

  /**
   * The provider reports money back to the buyer. Only a full refund is recorded: a partial one
   * leaves the payment paid for finance to settle by hand, because a paid deal cancels only after
   * all of the buyer's money has gone back.
   */
  refunded(input: {
    eventId: string;
    chargeId: string;
    refundedMinor: number;
    refundId: string | null;
  }): Promise<PaymentWebhookResult> {
    return this.deps.transactionRunner.runInTransaction(async (tx) => {
      if (!(await this.deps.claims.claim(tx, input.eventId))) return DUPLICATE;
      const scope = this.deps.scopeForTx(tx);
      const found = await scope.payments.findByChargeId(input.chargeId);
      if (!found) return UNKNOWN;
      const payment = await scope.payments.findByIdForUpdate(found.id);
      if (!payment) return UNKNOWN;
      if (input.refundedMinor < payment.amountMinor) {
        recordMoneyPathEvent("private_sale_partial_refund_not_recorded");
        return { processed: true, action: "refund_received", reason: "partial_refund" };
      }
      const updated = await this.recordRefund(scope, payment, input);
      return updated
        ? { processed: true, action: "refund_received" }
        : { processed: true, action: "skipped", reason: "payment_not_paid" };
    });
  }

  /** Records a refund the platform made itself, in the caller's transaction. */
  async recordRefund(
    scope: DealPaymentScope,
    payment: PrivateSaleDealPayment,
    refund: { refundedMinor: number; refundId: string | null },
  ): Promise<PrivateSaleDealPayment | null> {
    const updated = await scope.payments.markRefunded(payment.id, {
      refundedMinor: Math.min(refund.refundedMinor, payment.amountMinor),
      refundId: refund.refundId,
      at: (this.deps.now ?? (() => new Date()))(),
    });
    if (!updated) return null;
    const deal = await scope.deals.findById(payment.dealId);
    if (deal) {
      await this.publish(scope, deal, dealPaymentRefundedEvent(deal, updated), null, payment);
    }
    return updated;
  }

  private async publish(
    scope: DealPaymentScope,
    deal: DealRef,
    event: { eventType: string; payload: Record<string, unknown> },
    actorUserId: string | null,
    payment: Pick<PrivateSaleDealPayment, "buyerLegalEntityId">,
  ): Promise<void> {
    await scope.events.publish({
      aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
      aggregateId: deal.id,
      eventType: event.eventType,
      payload: event.payload,
      actorUserId,
      actingLegalEntityId: payment.buyerLegalEntityId,
    });
  }
}
