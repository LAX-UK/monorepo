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
import type { UnappliedMoneyReason } from "@auction/domain";
import type { IUnappliedMoneyRecorder } from "@auction/finance-runtime";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPaymentWriter,
  IPrivateSaleDealPayoutStore,
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
  | "transfer_in_flight"
  /** The buyer finished the checkout (a card taken, a transfer chosen), so money may still arrive. */
  | "checkout_completed"
  /** The buyer's checkout could not be confirmed ended, so it could yet be paid. */
  | "checkout_not_ended";

export type RecordTransferResult =
  | { ok: true; paymentId: string }
  | { ok: false; error: RecordTransferError };

/** Thrown inside the transaction to undo it when the deal turns out not to be waiting for money. */
class NotInvoiced extends Error {}

/** Thrown inside the transaction to undo it when another person has already paid the deal. */
class AlreadyPaid extends Error {}

/** Whether the database refused a row because another with the same unique key already exists. */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export type DealPaymentSettlementDeps = {
  transactionRunner: ITransactionRunner;
  /** The reads, writes and events of one transaction. */
  scopeForTx: (tx: Database) => DealPaymentScope;
  transitions: Pick<DealTransitionService, "transition">;
  claims: IProviderEventClaim;
  /** Opens a finance task and alert for money that could not be applied. Never refunds. */
  unappliedMoney: Pick<IUnappliedMoneyRecorder, "record">;
  /** Whether the seller's payout already includes a deal, so a refund may need it adjusted. */
  payouts: Pick<IPrivateSaleDealPayoutStore, "hasPayoutLine">;
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
      // Money that cannot be applied is never dropped: finance gets a task and an alert to return
      // it or apply it, and the payment is left as it is.
      if (payment.amountMinor !== input.amountMinor) {
        recordMoneyPathEvent("private_sale_payment_amount_mismatch");
        await this.unapplied(tx, payment, input, "amount_mismatch");
        return { processed: true, action: "unapplied_money_recorded", reason: "amount_mismatch" };
      }
      const paid = await scope.payments.markPaid(payment.id, {
        chargeId: input.chargeId,
        paymentIntentId: input.paymentIntentId,
        at: (this.deps.now ?? (() => new Date()))(),
      });
      if (!paid) {
        // The same money reported again changes nothing. Money that is not the money already
        // recorded (the checkout was ended, or the deal was paid another way) is finance's.
        if (isRecordedMoney(payment, input)) {
          return { processed: true, action: "skipped", reason: "payment_not_open" };
        }
        recordMoneyPathEvent("private_sale_payment_money_not_applied");
        await this.unapplied(tx, payment, input, "private_sale_payment_not_applied");
        return {
          processed: true,
          action: "unapplied_money_recorded",
          reason: "private_sale_payment_not_applied",
        };
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

  /**
   * Finance is told that money went back to the buyer after the seller's payout included the deal,
   * so the payout may need adjusting. `key` makes the task one per refund: a repeat of the same
   * report raises nothing new.
   */
  async raiseRefundAfterPayout(
    tx: Database,
    payment: PrivateSaleDealPayment,
    refund: { key: string; amountMinor: number },
  ): Promise<void> {
    recordMoneyPathEvent("private_sale_refund_after_payout");
    const deal = await this.deps.scopeForTx(tx).deals.findById(payment.dealId);
    await this.deps.unappliedMoney.record(
      tx,
      {
        reason: "private_sale_refund_after_payout",
        paymentId: null,
        paymentGroupId: null,
        stripePaymentIntentId: null,
        stripeChargeId: null,
        stripeCustomerId: null,
        stripeEventId: refund.key,
        privateSaleDealId: payment.dealId,
        privateSaleDealReference: deal?.reference ?? null,
        privateSaleDealPaymentId: payment.id,
        amountCents: refund.amountMinor,
        currency: payment.currency,
      },
      payment.buyerLegalEntityId,
    );
  }

  /** Opens the finance task for money the deal's payment could not take. */
  private async unapplied(
    tx: Database,
    payment: PrivateSaleDealPayment,
    money: {
      eventId: string;
      paymentIntentId: string | null;
      chargeId: string | null;
      amountMinor: number;
    },
    reason: UnappliedMoneyReason,
  ): Promise<void> {
    const deal = await this.deps.scopeForTx(tx).deals.findById(payment.dealId);
    await this.deps.unappliedMoney.record(
      tx,
      {
        reason,
        paymentId: null,
        paymentGroupId: null,
        stripePaymentIntentId: money.paymentIntentId,
        stripeChargeId: money.chargeId,
        stripeCustomerId: null,
        stripeEventId: money.eventId,
        privateSaleDealId: payment.dealId,
        privateSaleDealReference: deal?.reference ?? null,
        privateSaleDealPaymentId: payment.id,
        amountCents: money.amountMinor,
        currency: payment.currency,
      },
      payment.buyerLegalEntityId,
    );
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
      if (updated && (await this.deps.payouts.hasPayoutLine(payment.dealId))) {
        await this.raiseRefundAfterPayout(tx, payment, {
          key: input.eventId,
          amountMinor: updated.refundedMinor - payment.refundedMinor,
        });
      }
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
        // Someone else (a second finance user, or the buyer starting a checkout) took the deal's
        // one live payment first: this record is not made.
        if (claim.kind !== "created") throw new AlreadyPaid();
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
        // Undo the whole record if the deal moved under us: to paid by someone else, or out of
        // the stage that waits for money.
        if (moved.kind === "conflict") throw new AlreadyPaid();
        if (moved.kind !== "ok") throw new NotInvoiced();
        return { paymentId: paid.id } as const;
      });
      if ("error" in outcome) return { ok: false, error: outcome.error };
      paymentId = outcome.paymentId;
    } catch (error) {
      if (error instanceof NotInvoiced) return { ok: false, error: "not_invoiced" };
      // Two people recording at once: the database lets one in, the other is told it is paid.
      if (error instanceof AlreadyPaid || isUniqueViolation(error)) {
        return { ok: false, error: "already_paid" };
      }
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

/** Whether the money reported is the money the payment already holds, a repeat of the same report. */
function isRecordedMoney(
  payment: Pick<PrivateSaleDealPayment, "status" | "stripePaymentIntentId" | "stripeChargeId">,
  money: { paymentIntentId: string | null; chargeId: string | null },
): boolean {
  if (payment.status !== "paid" && payment.status !== "refunded") return false;
  return (
    (money.paymentIntentId !== null && money.paymentIntentId === payment.stripePaymentIntentId) ||
    (money.chargeId !== null && money.chargeId === payment.stripeChargeId)
  );
}
