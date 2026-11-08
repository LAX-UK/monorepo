import type { Database } from "@auction/db";
import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  dealBankTransferRecordedEvent,
  dealPaymentBlockers,
  dealPaymentCancelledEvent,
  dealPaymentDueMinor,
  dealPaymentPaidEvent,
  dealPaymentPartlyRefundedEvent,
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
  | "checkout_unavailable"
  /** Finance recorded the transfer by hand, so the checkout is no longer needed. */
  | "transfer_recorded";

/** Tells the buyer their payment was received. Sent after the payment is committed. */
export interface IDealReceipt {
  send(input: { paymentId: string }): Promise<void>;
}

export type RecordTransferError =
  | "not_found"
  /** The deal is not waiting for payment, or has no price. */
  | "not_invoiced"
  | "buyer_missing"
  /** The amount must be exactly what the buyer owes; a different amount is not recorded. */
  | "amount_mismatch"
  | "already_paid"
  /** The buyer's own bank transfer through the checkout is on its way; wait for it to land. */
  | "transfer_in_flight";

export type RecordTransferResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: RecordTransferError };

/** Thrown inside the transaction to undo it when the deal turns out not to be waiting for money. */
class NotInvoiced extends Error {}

export type DealPaymentSettlementDeps = {
  transactionRunner: ITransactionRunner;
  /** The reads, writes and events of one transaction. */
  scopeForTx: (tx: Database) => DealPaymentScope;
  transitions: Pick<DealTransitionService, "transition">;
  claims: IProviderEventClaim;
  /** The buyer's receipt; absent where emails are not sent. */
  receipt?: IDealReceipt;
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
  async settle(input: {
    eventId: string;
    paymentId: string;
    paymentIntentId: string | null;
    chargeId: string | null;
    amountMinor: number;
  }): Promise<PaymentWebhookResult> {
    const result = await this.settleInTransaction(input);
    if (result.processed && result.action === "payment_intent_succeeded" && !result.reason) {
      await this.sendReceipt(input.paymentId);
    }
    return result;
  }

  private settleInTransaction(input: {
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
   * The provider reports money back to the buyer. `refundedMinor` is the total returned on the
   * charge so far. A part refund is recorded on the payment, which stays paid; the deal can be
   * cancelled only once all of the buyer's money has gone back.
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
      const updated = await this.recordRefund(scope, payment, input);
      if (updated) {
        return {
          processed: true,
          action: "refund_received",
          ...(updated.status === "paid" ? { reason: "partial_refund" } : {}),
        };
      }
      // Nothing more than is already recorded, or the payment is not paid: a repeat changes nothing.
      return { processed: true, action: "skipped", reason: "payment_not_paid" };
    });
  }

  /**
   * Records money returned to the buyer, in the caller's transaction. `refundedMinor` is the total
   * returned so far: the whole amount closes the payment as refunded, less leaves it paid with the
   * amount recorded. A total no higher than the one already recorded changes nothing, so the
   * provider's report and the platform's own record of the same refund agree.
   */
  async recordRefund(
    scope: DealPaymentScope,
    payment: PrivateSaleDealPayment,
    refund: { refundedMinor: number; refundId: string | null },
  ): Promise<PrivateSaleDealPayment | null> {
    const total = Math.min(Math.max(refund.refundedMinor, 0), payment.amountMinor);
    const at = (this.deps.now ?? (() => new Date()))();
    const whole = total >= payment.amountMinor;
    const updated = whole
      ? await scope.payments.markRefunded(payment.id, {
          refundedMinor: total,
          refundId: refund.refundId,
          at,
        })
      : await scope.payments.markPartlyRefunded(payment.id, { refundedMinor: total, at });
    if (!updated) return null;
    const deal = await scope.deals.findById(payment.dealId);
    if (deal) {
      await this.publish(
        scope,
        deal,
        whole
          ? dealPaymentRefundedEvent(deal, updated)
          : dealPaymentPartlyRefundedEvent(deal, updated),
        null,
        payment,
      );
    }
    return updated;
  }

  /**
   * Finance saw the buyer's bank transfer land: it is recorded as the deal's paid payment and the
   * deal moves from invoiced to paid, in one transaction. The amount must be exactly what the
   * buyer owes. A checkout still open is let go in the same step; a transfer already on its way
   * through the checkout is left to land.
   */
  async recordTransferReceived(input: {
    dealId: string;
    recordedByUserId: string;
    bankReference: string;
    amountMinor: number;
  }): Promise<RecordTransferResult> {
    let paymentId: string;
    try {
      const outcome = await this.deps.transactionRunner.runInTransaction(async (tx) => {
        const scope = this.deps.scopeForTx(tx);
        const deal = await scope.deals.findById(input.dealId);
        if (!deal) return { error: "not_found" } as const;
        const live = await scope.payments.findLiveForDeal(deal.id);
        if (live?.status === "paid") return { error: "already_paid" } as const;
        if (live?.status === "processing") return { error: "transfer_in_flight" } as const;
        if (dealPaymentBlockers(deal).length > 0) return { error: "not_invoiced" } as const;
        const buyer = deal.buyer;
        if (!buyer) return { error: "buyer_missing" } as const;
        const due = dealPaymentDueMinor(deal);
        if (due === null || due !== input.amountMinor) return { error: "amount_mismatch" } as const;

        if (live) {
          const cancelled = await scope.payments.markCancelled(live.id);
          if (cancelled) {
            await this.publish(
              scope,
              deal,
              dealPaymentCancelledEvent(deal, cancelled, "transfer_recorded"),
              input.recordedByUserId,
              live,
            );
          }
        }
        const claim = await scope.payments.claim({
          dealId: deal.id,
          buyerLegalEntityId: buyer.legalEntityId,
          createdByUserId: buyer.actingUserId,
          rail: "gb_bank_transfer",
          amountMinor: due,
        });
        const paid = await scope.payments.markPaidByTransfer(claim.payment.id, {
          recordedByUserId: input.recordedByUserId,
          bankReference: input.bankReference,
          at: (this.deps.now ?? (() => new Date()))(),
        });
        if (!paid) return { error: "already_paid" } as const;
        await this.publish(
          scope,
          deal,
          dealBankTransferRecordedEvent(deal, paid),
          input.recordedByUserId,
          paid,
        );
        await this.publish(
          scope,
          deal,
          dealPaymentPaidEvent(deal, paid),
          input.recordedByUserId,
          paid,
        );
        const moved = await this.deps.transitions.transition(
          deal.id,
          "mark_paid",
          { actorUserId: input.recordedByUserId },
          scope,
        );
        // Undo the whole record if the deal was not waiting for money after all.
        if (moved.kind !== "ok") throw new NotInvoiced();
        return { paymentId: paid.id } as const;
      });
      if ("error" in outcome) return { ok: false, error: outcome.error };
      paymentId = outcome.paymentId;
    } catch (error) {
      if (error instanceof NotInvoiced) return { ok: false, error: "not_invoiced" };
      throw error;
    }
    recordMoneyPathEvent("private_sale_transfer_recorded");
    await this.sendReceipt(paymentId);
    return { ok: true, paymentId };
  }

  /** The receipt is a courtesy after the money is safely recorded, so a failure never undoes it. */
  private async sendReceipt(paymentId: string): Promise<void> {
    const { receipt } = this.deps;
    if (!receipt) return;
    try {
      await receipt.send({ paymentId });
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "private_sale_receipt_failed",
          paymentId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
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
