import type { StaffRoles, UserRole } from "@auction/types";
import { roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { AuthzError, PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { paymentProviderErrorFromUnknown } from "./payment-service-errors.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

/**
 * Money Stripe took on a payment that had already been closed (an abandoned checkout, say) sits
 * in finance's inbox. Finance either reinstates the payment, so the buyer gets what they paid
 * for, or sends the money back.
 */

type BlockedCaptureDeps = Pick<
  PaymentServiceDeps,
  | "payments"
  | "paymentCapture"
  | "stripePayments"
  | "transactionRunner"
  | "domainEventSink"
  | "paymentRefunds"
>;

type Outcome = Result<void, AuthzError | PaymentProviderError>;

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(e: unknown): boolean {
  const code = (e as { code?: string; cause?: { code?: string } } | null)?.code;
  return (
    code === UNIQUE_VIOLATION ||
    (e as { cause?: { code?: string } })?.cause?.code === UNIQUE_VIOLATION
  );
}

async function loadBlocked(
  deps: BlockedCaptureDeps,
  role: string,
  staffRoles: StaffRoles | undefined,
  paymentId: string,
) {
  if (!roleHasCapability(role as UserRole, "finance.platform.write", staffRoles)) {
    return err(new AuthzError("Forbidden", 403));
  }
  const payment = await deps.payments.findById(paymentId);
  if (!payment) return err(new AuthzError("Payment not found", 404));
  return ok(payment);
}

export async function reinstateBlockedCapture(
  deps: BlockedCaptureDeps,
  adminUserId: string,
  role: string,
  paymentId: string,
  staffRoles?: StaffRoles | undefined,
): Promise<Outcome> {
  const loaded = await loadBlocked(deps, role, staffRoles, paymentId);
  if (loaded.isErr()) return err(loaded.error);
  const payment = loaded.value;
  if (payment.status === "captured") return ok(undefined);
  if (payment.status !== "cancelled") {
    return err(new AuthzError("This payment is no longer closed", 409));
  }
  if (await deps.payments.isVoidedByBuyerDefault(paymentId)) {
    return err(
      new AuthzError(
        "This sale was cancelled after the buyer did not pay. Refund the payment instead.",
        409,
      ),
    );
  }
  const blocked = await deps.payments.findBlockedCapture(paymentId);
  if (!blocked) return err(new AuthzError("No payment was taken on this one", 409));
  if (!deps.paymentCapture || !deps.transactionRunner) {
    return err(new PaymentProviderError("Payment capture persistence is not configured", 500));
  }

  let reopened: boolean;
  try {
    reopened = await deps.transactionRunner.runInTransaction((tx) =>
      deps.payments.applyReopenedFromCancelledInTransaction(tx, paymentId),
    );
  } catch (e) {
    if (isUniqueViolation(e)) {
      return err(
        new AuthzError("A newer payment exists for this lot. Refund this one instead.", 409),
      );
    }
    throw e;
  }
  if (!reopened) return err(new AuthzError("This payment is no longer closed", 409));

  try {
    await deps.paymentCapture.capture({
      paymentId,
      via: "admin_manual",
      stripeChargeId: blocked.stripeChargeId,
      stripePaymentIntentId: blocked.stripePaymentIntentId,
      actorUserId: adminUserId,
      requireApply: true,
    });
  } catch (e) {
    // Put it back as it was, so a buyer can never pay a second time for a lot already paid.
    await deps.payments.updateStatus(paymentId, "cancelled");
    recordMoneyPathEvent("blocked_capture_reinstate_failed");
    console.error(
      JSON.stringify({
        msg: "blocked_capture_reinstate_failed",
        paymentId,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return err(new PaymentProviderError("The payment could not be reinstated. Try again.", 500));
  }
  recordMoneyPathEvent("blocked_capture_reinstated");
  return ok(undefined);
}

export async function refundBlockedCapture(
  deps: BlockedCaptureDeps,
  adminUserId: string,
  role: string,
  paymentId: string,
  staffRoles: StaffRoles | undefined,
  reason: string | undefined,
): Promise<Outcome> {
  const loaded = await loadBlocked(deps, role, staffRoles, paymentId);
  if (loaded.isErr()) return err(loaded.error);
  const payment = loaded.value;
  if (payment.status === "refunded") return ok(undefined);
  if (payment.status !== "cancelled") {
    return err(new AuthzError("This payment is no longer closed", 409));
  }
  const blocked = await deps.payments.findBlockedCapture(paymentId);
  if (!blocked) return err(new AuthzError("No payment was taken on this one", 409));
  const chargeId = blocked.stripeChargeId ?? payment.stripeChargeId;
  if (!chargeId) {
    return err(new PaymentProviderError("Cannot refund: no Stripe charge was recorded", 400));
  }
  if (!deps.stripePayments?.isConfigured()) {
    return err(new PaymentProviderError("Stripe is not configured for this environment", 503));
  }
  if (!deps.transactionRunner || !deps.domainEventSink || !deps.paymentRefunds) {
    return err(new PaymentProviderError("Payment refund persistence is not configured", 500));
  }
  const { transactionRunner, domainEventSink, paymentRefunds } = deps;
  const refundedPence =
    blocked.amountCents > 0 ? blocked.amountCents : gbpAmountToPence(payment.amount);

  let stripeRefundId: string | null = null;
  try {
    const outcome = await deps.stripePayments.createRefund({
      chargeId,
      amount: refundedPence,
      reason: "requested_by_customer",
      paymentId,
    });
    stripeRefundId = outcome.kind === "created" ? outcome.refundId : null;
  } catch (e) {
    return err(paymentProviderErrorFromUnknown(e));
  }

  try {
    await transactionRunner.runInTransaction(async (tx) => {
      await paymentRefunds.lockPaymentInTransaction(tx, paymentId);
      const refunded = await deps.payments.applyRefundedFromCancelledInTransaction(
        tx,
        paymentId,
        stripeRefundId,
      );
      if (!refunded) return;
      await paymentRefunds.recordInTransaction(tx, {
        paymentId,
        // No payout line exists for a closed payment, so this is the refund's only key.
        idempotencyKey: `blocked_capture_refund:${paymentId}`,
        stripeRefundId,
        amountPence: refundedPence,
        currency: "GBP",
        source: "blocked_capture",
      });
      await domainEventSink.withTx(tx).publish({
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.refunded",
        payload: {
          amount: payment.amount,
          currency: "GBP",
          sellerLegalEntityId: payment.sellerLegalEntityId ?? null,
          via: "admin_manual",
          stripeRefundId,
          ...(reason ? { staffReason: reason } : {}),
        },
        actorUserId: adminUserId,
        actingLegalEntityId: payment.sellerLegalEntityId ?? null,
      });
    });
  } catch (e) {
    recordMoneyPathEvent("refund_db_persist_failed");
    console.error(
      JSON.stringify({
        msg: "refund_db_persist_failed",
        paymentId,
        stripeRefundId,
        error: e instanceof Error ? e.message : String(e),
      }),
    );
    return err(
      new PaymentProviderError(
        "Stripe refund succeeded but the ledger update failed. Reconcile manually.",
        500,
      ),
    );
  }
  recordMoneyPathEvent("blocked_capture_refunded");
  return ok(undefined);
}
