import type { PaymentRecord } from "@auction/persistence";
import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import type Stripe from "stripe";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { AuthzError, PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import { ensureXeroInvoiceForPayment } from "./ensure-xero-invoice.js";
import { paymentProviderErrorFromUnknown } from "./payment-service-errors.js";
import type { PaymentServiceDeps } from "./payment-service-types.js";

export async function listAllForAdmin(
  deps: PaymentServiceDeps,
  userRole: string,
  userStaffRole?: string | null,
): Promise<Result<PaymentRecord[], AuthzError>> {
  if (
    !roleHasCapability(
      userRole as UserRole,
      "finance.read",
      normalizeUserStaffRole(userStaffRole ?? undefined),
    )
  ) {
    return err(new AuthzError("Forbidden", 403));
  }
  const rows = await deps.payments.listAll();
  return ok(rows);
}

export function countPendingOlderThanHours(
  deps: PaymentServiceDeps,
  hours: number,
): Promise<number> {
  return deps.payments.countPendingOlderThanHours(hours);
}

export function sumCapturedBetween(
  deps: PaymentServiceDeps,
  start: Date,
  end: Date,
): Promise<string> {
  return deps.payments.sumCapturedBetween(start, end);
}

/**
 * Backfill the Xero ACCREC invoice for a settleable payment that has none yet (created while
 * Xero was unavailable in non-blocking mode). Idempotent: `ensureInvoiceForPayment` early-returns
 * when an invoice already exists, and is a no-op while Xero is still disconnected. Drained by the
 * `retry-xero-invoice-creation` cron; the existing capture-sync cron then records the bank payment.
 */
export async function backfillXeroInvoiceForPayment(
  deps: PaymentServiceDeps,
  paymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!deps.accounting.isConfigured()) {
    return { ok: false, error: "accounting_not_configured" };
  }
  const p = await deps.payments.findById(paymentId);
  if (!p) return { ok: false, error: "payment_not_found" };
  if (p.status !== "pending" && p.status !== "authorized" && p.status !== "captured") {
    return { ok: false, error: "payment_not_settleable" };
  }
  const lot = await deps.lots.findById(p.lotId);
  if (!lot) return { ok: false, error: "lot_not_found" };
  const buyerId = p.buyerId ?? p.paidByUserId;
  if (!buyerId) return { ok: false, error: "buyer_not_found" };
  const result = await ensureXeroInvoiceForPayment(
    deps.accounting,
    deps.users,
    paymentId,
    lot,
    buyerId,
    p.amount,
  );
  if (result.ok) {
    recordMoneyPathEvent("xero_invoice_backfilled");
  }
  return result;
}

export async function markCapturedByAdmin(
  deps: PaymentServiceDeps,
  adminUserId: string | null | undefined,
  userRole: string,
  paymentId: string,
  actingLegalEntityId?: string | null,
  userStaffRole?: string | null,
): Promise<Result<void, AuthzError | PaymentProviderError>> {
  const isPlatformFinanceWrite = roleHasCapability(
    userRole as UserRole,
    "finance.platform.write",
    normalizeUserStaffRole(userStaffRole ?? undefined),
  );
  if (!isPlatformFinanceWrite && !actingLegalEntityId) {
    return err(new AuthzError("Forbidden", 403));
  }
  const p = await deps.payments.findById(paymentId);
  if (!p) {
    return err(new AuthzError("Payment not found", 404));
  }
  if (
    !isPlatformFinanceWrite &&
    (!p.sellerLegalEntityId || p.sellerLegalEntityId !== actingLegalEntityId)
  ) {
    return err(new AuthzError("Forbidden", 403));
  }
  if (p.status === "captured") {
    return ok(undefined);
  }
  if (p.status === "requires_manual_review") {
    return err(new AuthzError("Payment requires platform manual review", 409));
  }

  let resolvedChargeId: string | null = p.stripeChargeId;

  if (p.stripePaymentIntentId) {
    if (!deps.stripePayments?.isConfigured()) {
      return err(
        new PaymentProviderError("Stripe is not configured for this environment", 503, undefined),
      );
    }
    let pi: Stripe.PaymentIntent;
    try {
      pi = await deps.stripePayments.capturePaymentIntent(p.stripePaymentIntentId);
    } catch (e) {
      return err(paymentProviderErrorFromUnknown(e));
    }
    const expectedPence = gbpAmountToPence(p.amount);
    if (pi.amount !== expectedPence) {
      recordMoneyPathEvent("admin_capture_amount_mismatch");
      return err(
        new PaymentProviderError(
          "Stripe payment amount does not match the invoice total",
          400,
          "payment_intent_amount_mismatch",
        ),
      );
    }
    const lc = pi.latest_charge;
    const fromPi =
      typeof lc === "string"
        ? lc
        : lc && typeof lc === "object" && "id" in lc
          ? (lc as Stripe.Charge).id
          : null;
    if (fromPi) {
      resolvedChargeId = fromPi;
    }
  }

  if (!deps.paymentCapture) {
    return err(new PaymentProviderError("Payment capture persistence is not configured", 500));
  }

  await deps.paymentCapture.capture({
    paymentId,
    via: p.stripePaymentIntentId ? "stripe_payment_intent" : "admin_manual",
    stripeChargeId: resolvedChargeId,
    stripePaymentIntentId: p.stripePaymentIntentId,
    actorUserId: adminUserId ?? null,
  });

  return ok(undefined);
}

export async function releaseManualReviewForCapture(
  deps: PaymentServiceDeps,
  adminUserId: string,
  userRole: string,
  paymentId: string,
  userStaffRole?: string | null,
): Promise<Result<void, AuthzError>> {
  if (
    !roleHasCapability(
      userRole as UserRole,
      "finance.platform.write",
      normalizeUserStaffRole(userStaffRole ?? undefined),
    )
  ) {
    return err(new AuthzError("Forbidden", 403));
  }
  const p = await deps.payments.findById(paymentId);
  if (!p) {
    return err(new AuthzError("Payment not found", 404));
  }
  if (p.status !== "requires_manual_review") {
    return err(new AuthzError("Payment is not in manual review", 409));
  }
  if (deps.settlementCompliance) {
    const amountPence = gbpAmountToPence(p.amount);
    const compliance = await deps.settlementCompliance.evaluate({
      buyerUserId: p.paidByUserId ?? (p as PaymentRecord & { buyerId?: string }).buyerId ?? "",
      amountPence,
      excludePaymentId: paymentId,
    });
    if (compliance.hold) {
      const code =
        compliance.reason === "aml_hold"
          ? "payment_release_blocked_aml_hold"
          : "payment_release_blocked_source_of_funds";
      const message =
        compliance.reason === "aml_hold"
          ? "Cannot release: buyer is on an AML/sanctions compliance hold. MLRO must clear the screening first."
          : "Cannot release: source-of-funds review is required or pending. Compliance must approve the SoF case first.";
      return err(new AuthzError(message, 403, { code }));
    }
  }
  const transactionRunner = deps.transactionRunner;
  const publisher = deps.domainEventPublisher;
  if (!transactionRunner || !publisher) {
    await deps.payments.updateStatus(paymentId, "pending");
    return ok(undefined);
  }

  try {
    await transactionRunner.runInTransaction(async (tx) => {
      const released = await deps.payments.applyReleasedFromManualReviewInTransaction(
        tx,
        paymentId,
      );
      if (!released) {
        throw new Error("payment_not_in_manual_review");
      }
      await publisher.publish(tx, {
        aggregateType: "payment",
        aggregateId: paymentId,
        eventType: "payment.manual_review_released",
        payload: {
          paymentId,
          lotId: p.lotId,
          sellerLegalEntityId: p.sellerLegalEntityId ?? null,
          action: "capture_and_process",
        },
        actorUserId: adminUserId,
        actingLegalEntityId: p.sellerLegalEntityId ?? null,
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "payment_not_in_manual_review") {
      return err(new AuthzError("Payment is not in manual review", 409));
    }
    throw e;
  }
  return ok(undefined);
}

export async function syncPaymentFromXeroAsAdmin(
  deps: PaymentServiceDeps,
  userRole: string,
  paymentId: string,
  userStaffRole?: string | null,
): Promise<Result<{ ok: boolean; error?: string }, AuthzError>> {
  if (
    !roleHasCapability(
      userRole as UserRole,
      "finance.platform.write",
      normalizeUserStaffRole(userStaffRole ?? undefined),
    )
  ) {
    return err(new AuthzError("Forbidden", 403));
  }
  const r = await deps.accounting.syncPaymentFromProvider(paymentId);
  if (!r.ok) {
    return ok({ ok: false, error: r.error ?? "Xero sync failed" });
  }
  return ok({ ok: true });
}
