import type { Database } from "@auction/db";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { IXeroPaymentRecorder } from "../accounting/xero-payment-recorder.js";
import type { DomainEventPublisher } from "../domain-event.publisher.js";
import type { IPaymentWriteRepository, PaymentRecord } from "../interfaces/payment-write.js";
import type { IPayoutAdjustmentService } from "../interfaces/payout-adjustment.js";
import type { PaymentRefundReconcileService } from "./payment-refund-reconcile.service.js";

export type RefundLedgerDeps = {
  payments: IPaymentWriteRepository;
  db: Database;
  domainEventPublisher: DomainEventPublisher;
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

export async function executePaymentRefundLedger(
  deps: RefundLedgerDeps,
  input: {
    payment: PaymentRecord;
    adminUserId: string;
    stripeRefundId: string | null;
    via: "admin_manual" | "admin_manual_review";
    eventReason?: "seller_archived";
    sourceEventId: string;
    clawbackNote: string;
    logViaField: boolean;
  },
): Promise<Result<void, PaymentProviderError>> {
  const { payment, adminUserId, stripeRefundId, via, sourceEventId, clawbackNote, logViaField } =
    input;
  const paymentId = payment.id;

  try {
    await deps.db.transaction(async (tx) => {
      const refunded = await deps.payments.applyRefundedInTransaction(
        tx,
        paymentId,
        stripeRefundId,
      );
      if (!refunded) {
        return;
      }
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
      await deps.domainEventPublisher.publish(tx, {
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
