import type { Database } from "@auction/db";
import {
  PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
  dealBankRefundRecordedEvent,
  dealRefundRecorded,
  dealRefundableMinor,
} from "@auction/domain";
import type {
  IPrivateSaleDealPaymentReader,
  IPrivateSaleDealPayoutStore,
  IPrivateSaleDealReader,
  ITransactionRunner,
} from "@auction/persistence/interfaces";
import type { IStripeCaptureRefundGateway } from "../stripe/stripe-payment-gateway.js";
import type { IDealCheckoutGateway } from "./deal-payment-ports.js";
import type {
  DealPaymentScope,
  DealPaymentSettlementService,
} from "./deal-payment-settlement.service.js";
import type { DealTransitionOutcome, DealTransitionService } from "./deal-transition.service.js";

export type RefundDealError =
  | "not_found"
  /** There is no paid payment to return. */
  | "nothing_to_refund"
  /** The amount is not between one penny and what is left to return. */
  | "invalid_amount"
  /** The payment came by a transfer finance recorded, so it is returned at the bank, not at Stripe. */
  | "bank_transfer_payment"
  /** A bank refund is recorded only for a payment finance recorded by hand. */
  | "not_a_recorded_transfer"
  /** The payout already includes the deal, so the money cannot be pulled back from here. */
  | "payout_queued"
  | "refund_unavailable";

export type RefundDealResult =
  | { ok: true; refundedMinor: number; remainingMinor: number }
  | { ok: false; error: RefundDealError };

export type DealReversalDeps = {
  deals: Pick<IPrivateSaleDealReader, "findById">;
  payments: Pick<IPrivateSaleDealPaymentReader, "listForDeal">;
  payouts: Pick<IPrivateSaleDealPayoutStore, "hasPayoutLine">;
  refunds: Pick<IStripeCaptureRefundGateway, "isConfigured" | "createRefund">;
  checkout: Pick<IDealCheckoutGateway, "expireCheckout">;
  settlement: Pick<
    DealPaymentSettlementService,
    "recordRefund" | "cancel" | "raiseRefundAfterPayout"
  >;
  transitions: Pick<DealTransitionService, "transition">;
  transactionRunner: ITransactionRunner;
  scopeForTx: (tx: Database) => DealPaymentScope;
};

/**
 * Takes a deal back: returns the buyer's money through the same refund path as a lot payment,
 * and cancels the deal. A deal that was paid cancels only after the refund is recorded, so state
 * is never edited around money that has not moved.
 */
export class DealReversalService {
  constructor(private readonly deps: DealReversalDeps) {}

  /**
   * Returns the buyer's money: the whole of what is left, or `amountMinor` of it. Each part
   * refund is a refund of its own at the provider and is recorded on the payment, which stays paid
   * until all of the money has gone back.
   */
  async refund(input: {
    dealId: string;
    actorUserId: string;
    amountMinor?: number;
  }): Promise<RefundDealResult> {
    const deal = await this.deps.deals.findById(input.dealId);
    if (!deal) return { ok: false, error: "not_found" };
    const payments = await this.deps.payments.listForDeal(deal.id);
    const paid = payments.find((p) => p.status === "paid");
    if (!paid) return { ok: false, error: "nothing_to_refund" };
    const remaining = dealRefundableMinor(paid);
    if (remaining <= 0) return { ok: false, error: "nothing_to_refund" };
    const amount = input.amountMinor ?? remaining;
    if (!Number.isInteger(amount) || amount < 1 || amount > remaining) {
      return { ok: false, error: "invalid_amount" };
    }
    if (await this.deps.payouts.hasPayoutLine(deal.id)) {
      return { ok: false, error: "payout_queued" };
    }
    if (paid.bankReference !== null) return { ok: false, error: "bank_transfer_payment" };
    if (!paid.stripeChargeId || !this.deps.refunds.isConfigured()) {
      return { ok: false, error: "refund_unavailable" };
    }
    // Idempotent per payment: a retry after a failure returns the refund already made.
    const refund = await this.deps.refunds.createRefund({
      chargeId: paid.stripeChargeId,
      amount,
      paymentId: paid.id,
      // The amount already returned tells this refund from an earlier one of the same size.
      sequence: paid.refundedMinor,
      reason: "requested_by_customer",
    });
    await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const scope = this.deps.scopeForTx(tx);
      const locked = await scope.payments.findByIdForUpdate(paid.id);
      if (!locked) return;
      // The total returned: what was returned before plus this refund. If the provider's report of
      // it landed first, the higher of the two is the same figure and nothing is counted twice.
      await this.deps.settlement.recordRefund(scope, locked, {
        refundedMinor: Math.max(locked.refundedMinor, paid.refundedMinor + amount),
        refundId: refund.kind === "created" ? refund.refundId : null,
      });
    });
    return { ok: true, refundedMinor: amount, remainingMinor: remaining - amount };
  }

  /**
   * Finance returned money to the buyer by bank for a transfer they had recorded, and records it
   * here with the amount and the bank's reference. Nothing moves at the provider: this is the
   * record of what finance did, so it takes the same care as recording the transfer. The amount
   * is checked under the payment's lock, so two people recording at once cannot return more than
   * was paid, and the payment closes as refunded only when all of it has gone back.
   */
  async recordBankRefund(input: {
    dealId: string;
    actorUserId: string;
    amountMinor: number;
    bankReference: string;
  }): Promise<RefundDealResult> {
    const deal = await this.deps.deals.findById(input.dealId);
    if (!deal) return { ok: false, error: "not_found" };
    const paid = (await this.deps.payments.listForDeal(deal.id)).find((p) => p.status === "paid");
    if (!paid) return { ok: false, error: "nothing_to_refund" };
    if (paid.bankReference === null) return { ok: false, error: "not_a_recorded_transfer" };
    if (await this.deps.payouts.hasPayoutLine(deal.id)) {
      return { ok: false, error: "payout_queued" };
    }
    const recorded = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const scope = this.deps.scopeForTx(tx);
      const locked = await scope.payments.findByIdForUpdate(paid.id);
      if (!locked || locked.status !== "paid") return { error: "nothing_to_refund" } as const;
      // The payout may have been queued since the check above: look again now the payment is held.
      if (await this.deps.payouts.hasPayoutLine(deal.id))
        return { error: "payout_queued" } as const;
      const remaining = dealRefundableMinor(locked);
      if (remaining <= 0) return { error: "nothing_to_refund" } as const;
      if (
        !Number.isInteger(input.amountMinor) ||
        input.amountMinor < 1 ||
        input.amountMinor > remaining
      ) {
        return { error: "invalid_amount" } as const;
      }
      const total = locked.refundedMinor + input.amountMinor;
      const updated = await this.deps.settlement.recordRefund(scope, locked, {
        refundedMinor: total,
        refundId: null,
      });
      if (!updated) return { error: "nothing_to_refund" } as const;
      const event = dealBankRefundRecordedEvent(deal, {
        paymentId: locked.id,
        amountMinor: input.amountMinor,
        refundedMinor: updated.refundedMinor,
        bankReference: input.bankReference,
      });
      await scope.events.publish({
        aggregateType: PRIVATE_SALE_DEAL_EVENT_AGGREGATE,
        aggregateId: deal.id,
        eventType: event.eventType,
        payload: event.payload,
        actorUserId: input.actorUserId,
        actingLegalEntityId: locked.buyerLegalEntityId,
      });
      // A payout queued after that look, while the record was made, still has to be told: the money
      // has gone back, so finance is asked to look at the seller's payout.
      if (await this.deps.payouts.hasPayoutLine(deal.id)) {
        await this.deps.settlement.raiseRefundAfterPayout(tx, locked, {
          key: `bank_refund:${locked.id}:${updated.refundedMinor}`,
          amountMinor: input.amountMinor,
        });
      }
      return { remainingMinor: remaining - input.amountMinor } as const;
    });
    if ("error" in recorded) return { ok: false, error: recorded.error };
    return { ok: true, refundedMinor: input.amountMinor, remainingMinor: recorded.remainingMinor };
  }

  /**
   * Cancels the deal. An open checkout is ended first so it cannot be paid afterwards; a paid deal
   * needs its refund recorded, which the state machine checks.
   */
  async cancel(input: {
    dealId: string;
    actorUserId: string;
    reason: string;
    expectedVersion?: number;
  }): Promise<DealTransitionOutcome> {
    const payments = await this.deps.payments.listForDeal(input.dealId);
    // A bank transfer already on its way cannot be called back: wait for it to land, then refund.
    if (payments.some((p) => p.status === "processing")) return { kind: "conflict" };
    for (const open of payments.filter((p) => p.status === "open")) {
      if (open.stripeCheckoutSessionId) {
        await this.deps.checkout.expireCheckout(open.stripeCheckoutSessionId);
      }
      await this.deps.settlement.cancel({
        eventId: null,
        paymentId: open.id,
        reason: "checkout_cancelled",
      });
    }
    // Ending the deal also ends the artwork's hold in the same transaction. If the register cannot
    // record that, the cancel is undone but the checkout ended above stays ended; a retry of the
    // cancel recovers, because there is nothing open left to end.
    return this.deps.transitions.transition(input.dealId, "cancel", {
      actorUserId: input.actorUserId,
      cancelReason: input.reason,
      refundRecorded: payments.some((p) => dealRefundRecorded(p)),
      ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
    });
  }
}
