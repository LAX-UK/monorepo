import type { Database } from "@auction/db";
import { dealRefundRecorded } from "@auction/domain";
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
  /** The payout already includes the deal, so the money cannot be pulled back from here. */
  | "payout_queued"
  | "refund_unavailable";

export type RefundDealResult =
  | { ok: true; refundedMinor: number }
  | { ok: false; error: RefundDealError };

export type DealReversalDeps = {
  deals: Pick<IPrivateSaleDealReader, "findById">;
  payments: Pick<IPrivateSaleDealPaymentReader, "listForDeal">;
  payouts: Pick<IPrivateSaleDealPayoutStore, "hasPayoutLine">;
  refunds: Pick<IStripeCaptureRefundGateway, "isConfigured" | "createRefund">;
  checkout: Pick<IDealCheckoutGateway, "expireCheckout">;
  settlement: Pick<DealPaymentSettlementService, "recordRefund" | "cancel">;
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

  /** Returns the whole of the buyer's payment. */
  async refund(input: { dealId: string; actorUserId: string }): Promise<RefundDealResult> {
    const deal = await this.deps.deals.findById(input.dealId);
    if (!deal) return { ok: false, error: "not_found" };
    const payments = await this.deps.payments.listForDeal(deal.id);
    const paid = payments.find((p) => p.status === "paid");
    if (!paid) return { ok: false, error: "nothing_to_refund" };
    if (await this.deps.payouts.hasPayoutLine(deal.id)) {
      return { ok: false, error: "payout_queued" };
    }
    if (!paid.stripeChargeId || !this.deps.refunds.isConfigured()) {
      return { ok: false, error: "refund_unavailable" };
    }
    // Idempotent per payment: a retry after a failure returns the refund already made.
    const refund = await this.deps.refunds.createRefund({
      chargeId: paid.stripeChargeId,
      amount: paid.amountMinor,
      paymentId: paid.id,
      reason: "requested_by_customer",
    });
    await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const scope = this.deps.scopeForTx(tx);
      const locked = await scope.payments.findByIdForUpdate(paid.id);
      if (!locked) return;
      await this.deps.settlement.recordRefund(scope, locked, {
        refundedMinor: locked.amountMinor,
        refundId: refund.kind === "created" ? refund.refundId : null,
      });
    });
    return { ok: true, refundedMinor: paid.amountMinor };
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
    return this.deps.transitions.transition(input.dealId, "cancel", {
      actorUserId: input.actorUserId,
      cancelReason: input.reason,
      refundRecorded: payments.some((p) => dealRefundRecorded(p)),
      ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
    });
  }
}
