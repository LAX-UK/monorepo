import type {
  IPaymentRefundLedger,
  IPaymentWriteRepository,
  PaymentRecord,
} from "@auction/persistence/interfaces";
import type { IStripeRefundWatchRepository } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IXeroPaymentRecorder } from "../accounting/xero-payment-recorder.js";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { StripeRefundGatewayResult } from "../stripe/stripe-payment-gateway.js";
import { isCountedRefund, isReturnedNothing } from "../stripe/stripe-refund-status.js";
import type { PaymentRefundReconcileService } from "./payment-refund-reconcile.service.js";

export type RefundLedgerDeps = {
  payments: IPaymentWriteRepository;
  /** What the buyer was refunded, written with the `payment.refunded` event. */
  paymentRefunds: IPaymentRefundLedger;
  transactionRunner: import("@auction/persistence/interfaces").ITransactionRunner;
  domainEventSink: IDomainEventSink;
  payoutAdjustments: IPayoutAdjustmentService | null;
  paymentRefundReconcile: PaymentRefundReconcileService | null;
  xeroPaymentRecorder: IXeroPaymentRecorder | null;
};

async function recordXeroRefundCreditNote(
  xeroPaymentRecorder: IXeroPaymentRecorder | null,
  paymentId: string,
  amount: string,
  reference: string,
): Promise<void> {
  if (!xeroPaymentRecorder) return;
  const result = await xeroPaymentRecorder.recordRefundCreditNote(paymentId, amount, reference);
  if (!result.ok) {
    recordMoneyPathEvent("xero_refund_credit_note_failed");
  }
}

/** Who made a staff refund and why: everything its record needs except the payment itself. */
export type StaffRefundContext = {
  paymentId: string;
  adminUserId: string;
  via: "admin_manual" | "admin_manual_review";
  eventReason?: "seller_archived";
  /** The staff member's written reason, kept on the audit event. */
  staffReason?: string;
  sourceEventId: string;
  clawbackNote: string;
  logViaField: boolean;
};

export type StaffRefundLedgerInput = Omit<StaffRefundContext, "paymentId"> & {
  payment: PaymentRecord;
  stripeRefundId: string | null;
};

/**
 * A staff refund is recorded, announced and clawed back only once Stripe says it succeeded.
 * Answers `null` when it has (record it now). A refund Stripe did not make is an error, and
 * nothing is recorded. One still pending is watched with who made it and why, and the refund
 * reconcile job records it as this staff refund once it succeeds. One Stripe reports was already
 * made (whose status this call cannot see) is left to the refund webhooks, which count it once
 * it has succeeded; for money held in manual review, which they never touch, it is recorded here
 * as before. A deferred refund succeeds now with nothing recorded yet.
 */
export async function deferUnlessRefundSucceeded(
  refundWatch: Pick<IStripeRefundWatchRepository, "watch"> | null,
  input: {
    chargeId: string;
    outcome: StripeRefundGatewayResult;
    context: StaffRefundContext;
  },
): Promise<Result<void, PaymentProviderError> | null> {
  const { outcome, context } = input;
  if (outcome.kind === "already_refunded") {
    recordMoneyPathEvent("staff_refund_already_made");
    // Money held in manual review was never applied to the invoice, so the refund webhooks leave
    // it alone: only this call can record it, as before.
    return context.via === "admin_manual_review" ? null : ok(undefined);
  }
  if (isCountedRefund(outcome.status)) return null;
  if (isReturnedNothing(outcome.status)) {
    recordMoneyPathEvent("staff_refund_not_made");
    return err(new PaymentProviderError(`Stripe did not make the refund (${outcome.status})`, 502));
  }
  recordMoneyPathEvent("staff_refund_pending_at_provider");
  await refundWatch?.watch([
    {
      stripeRefundId: outcome.refundId,
      stripeChargeId: input.chargeId,
      status: outcome.status,
      amountPence: outcome.amountPence,
      paymentId: context.paymentId,
      staffRefund: context,
    },
  ]);
  console.info(
    JSON.stringify({
      msg: "staff_refund_pending_at_provider",
      paymentId: context.paymentId,
      stripeRefundId: outcome.refundId,
      status: outcome.status,
      adminUserId: context.adminUserId,
      via: context.via,
    }),
  );
  return ok(undefined);
}

/** The staff context kept on a watched refund, or null when the row holds none (or another shape). */
export function staffRefundContextOf(value: unknown): StaffRefundContext | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const via = v.via;
  if (
    typeof v.paymentId !== "string" ||
    typeof v.adminUserId !== "string" ||
    typeof v.sourceEventId !== "string" ||
    typeof v.clawbackNote !== "string" ||
    (via !== "admin_manual" && via !== "admin_manual_review")
  ) {
    return null;
  }
  return {
    paymentId: v.paymentId,
    adminUserId: v.adminUserId,
    via,
    ...(v.eventReason === "seller_archived" ? { eventReason: "seller_archived" as const } : {}),
    ...(typeof v.staffReason === "string" ? { staffReason: v.staffReason } : {}),
    sourceEventId: v.sourceEventId,
    clawbackNote: v.clawbackNote,
    logViaField: v.logViaField === true,
  };
}

export async function executePaymentRefundLedger(
  deps: RefundLedgerDeps,
  input: StaffRefundLedgerInput,
): Promise<Result<void, PaymentProviderError>> {
  const { payment, adminUserId, stripeRefundId, via, sourceEventId, clawbackNote, logViaField } =
    input;
  const paymentId = payment.id;

  try {
    await deps.transactionRunner.runInTransaction(async (tx) => {
      // The same row a card refund event locks, so the two never record side by side.
      await deps.paymentRefunds.lockPaymentInTransaction(tx, paymentId);
      const refunded = await deps.payments.applyRefundedInTransaction(
        tx,
        paymentId,
        stripeRefundId,
      );
      if (!refunded) {
        return;
      }
      // The buyer's record does not depend on the seller: a payment with no payout line to
      // reverse (no seller, or no adjustment service) was still refunded.
      await deps.paymentRefunds.recordInTransaction(tx, {
        paymentId,
        // The key of the payout line below, so a backfill from payout lines knows this refund.
        idempotencyKey: sourceEventId,
        stripeRefundId,
        amountPence: gbpAmountToPence(payment.amount),
        currency: "GBP",
        source: "staff",
      });
      if (deps.payoutAdjustments && payment.sellerLegalEntityId) {
        const negativeAmount = (-gbpAmountToPence(payment.amount) / 100).toFixed(2);
        await deps.payoutAdjustments.addPaymentLineToOpenPayoutOrCreateClawback({
          legalEntityId: payment.sellerLegalEntityId,
          paymentId,
          amount: negativeAmount,
          kind: "refund",
          sourceEventId,
          note: clawbackNote,
          tx,
        });
      }
      const payload: {
        amount: string;
        currency: "GBP";
        sellerLegalEntityId: string | null;
        via: "admin_manual" | "admin_manual_review";
        stripeRefundId: string | null;
        reason?: "seller_archived";
        staffReason?: string;
      } = {
        amount: payment.amount,
        currency: "GBP",
        sellerLegalEntityId: payment.sellerLegalEntityId ?? null,
        via,
        stripeRefundId,
      };
      if (input.eventReason !== undefined) {
        payload.reason = input.eventReason;
      }
      if (input.staffReason !== undefined) {
        payload.staffReason = input.staffReason;
      }
      await deps.domainEventSink.withTx(tx).publish({
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.refunded",
        payload,
        actorUserId: adminUserId,
        actingLegalEntityId: payment.sellerLegalEntityId ?? null,
      });
    });
  } catch (persistErr) {
    recordMoneyPathEvent("refund_db_persist_failed");
    if (deps.paymentRefundReconcile) {
      await deps.paymentRefundReconcile.enqueue({
        paymentId,
        stripeRefundId,
        adminUserId,
        payload: {
          sellerLegalEntityId: payment.sellerLegalEntityId ?? null,
          amount: payment.amount,
          stripeRefundId,
          via,
        },
      });
    }
    const logPayload: {
      msg: string;
      paymentId: string;
      stripeRefundId: string | null;
      via?: "admin_manual_review";
      error: string;
    } = {
      msg: "refund_db_persist_failed",
      paymentId,
      stripeRefundId,
      error: persistErr instanceof Error ? persistErr.message : String(persistErr),
    };
    if (logViaField) {
      logPayload.via = "admin_manual_review";
    }
    console.error(JSON.stringify(logPayload));
    return err(
      new PaymentProviderError(
        "Stripe refund succeeded but local ledger update failed — manual reconciliation required",
        500,
      ),
    );
  }

  await recordXeroRefundCreditNote(
    deps.xeroPaymentRecorder,
    paymentId,
    payment.amount,
    sourceEventId,
  );
  return ok(undefined);
}
