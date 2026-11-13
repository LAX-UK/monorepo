import { type StaffRoles, type UserRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { AuthzError, PaymentProviderError } from "../../lib/errors.js";
import { paymentProviderErrorFromUnknown } from "./payment-service-errors.js";
import { type PaymentServiceDeps, REFUND_BLOCKED_STATUSES } from "./payment-service-types.js";
import {
  type StaffRefundContext,
  deferUnlessRefundSucceeded,
  executePaymentRefundLedger,
} from "./refund-execution.js";

/**
 * A payment settled together with other invoices shares their charge, so its refund names the
 * invoice (always by amount, never "the whole charge").
 */
function groupedRefundRef(p: { id: string; paymentGroupId?: string | null }): {
  paymentId?: string;
} {
  return p.paymentGroupId ? { paymentId: p.id } : {};
}

export async function refundPayment(
  deps: PaymentServiceDeps,
  adminUserId: string,
  userRole: string,
  paymentId: string,
  actingLegalEntityId?: string | null,
  userStaffRoles?: StaffRoles | undefined,
  staffReason?: string,
): Promise<Result<void, AuthzError | PaymentProviderError>> {
  const isPlatformFinanceWrite = roleHasCapability(
    userRole as UserRole,
    "finance.platform.write",
    userStaffRoles,
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
  if (p.status === "refunded") {
    return ok(undefined);
  }

  if (deps.legalEntityRepository && p.sellerLegalEntityId) {
    const sellerEntity = await deps.legalEntityRepository.findById(p.sellerLegalEntityId);
    if (sellerEntity && REFUND_BLOCKED_STATUSES.includes(sellerEntity.status)) {
      return err(new AuthzError(`Cannot refund: seller entity is ${sellerEntity.status}`, 400));
    }
  }

  if (!p.stripeChargeId) {
    return err(new PaymentProviderError("Cannot refund: payment has no Stripe charge id", 400));
  }
  if (!deps.stripePayments?.isConfigured()) {
    return err(
      new PaymentProviderError("Stripe is not configured for this environment", 503, undefined),
    );
  }
  if (!deps.transactionRunner || !deps.domainEventSink || !deps.paymentRefunds) {
    return err(new PaymentProviderError("Payment refund persistence is not configured", 500));
  }

  let refundOutcome: Awaited<
    ReturnType<NonNullable<PaymentServiceDeps["stripePayments"]>["createRefund"]>
  >;
  try {
    refundOutcome = await deps.stripePayments.createRefund({
      chargeId: p.stripeChargeId,
      amount: gbpAmountToPence(p.amount),
      reason: "requested_by_customer",
      ...groupedRefundRef(p),
    });
  } catch (e) {
    return err(paymentProviderErrorFromUnknown(e));
  }

  const context: StaffRefundContext = {
    paymentId,
    adminUserId,
    via: "admin_manual",
    ...(staffReason ? { staffReason } : {}),
    sourceEventId: `admin_refund:${paymentId}`,
    clawbackNote: `Admin refund: ${paymentId}`,
    logViaField: false,
  };
  const deferred = await deferUnlessRefundSucceeded(deps.refundWatch ?? null, {
    chargeId: p.stripeChargeId,
    outcome: refundOutcome,
    context,
  });
  if (deferred) return deferred;
  const stripeRefundId = refundOutcome.kind === "created" ? refundOutcome.refundId : null;

  return executePaymentRefundLedger(
    {
      payments: deps.payments,
      paymentRefunds: deps.paymentRefunds,
      transactionRunner: deps.transactionRunner,
      domainEventSink: deps.domainEventSink,
      payoutAdjustments: deps.payoutAdjustments,
      paymentRefundReconcile: deps.paymentRefundReconcile,
      xeroPaymentRecorder: deps.xeroPaymentRecorder,
    },
    { ...context, payment: p, stripeRefundId },
  );
}

export async function refundManualReviewPayment(
  deps: PaymentServiceDeps,
  adminUserId: string,
  userRole: string,
  paymentId: string,
  userStaffRoles?: StaffRoles | undefined,
  reason?: string,
): Promise<Result<void, AuthzError | PaymentProviderError>> {
  if (!roleHasCapability(userRole as UserRole, "finance.platform.write", userStaffRoles)) {
    return err(new AuthzError("Forbidden", 403));
  }
  const p = await deps.payments.findById(paymentId);
  if (!p) {
    return err(new AuthzError("Payment not found", 404));
  }
  if (p.status !== "requires_manual_review") {
    return err(new AuthzError("Payment is not in manual review", 409));
  }
  if (!deps.transactionRunner || !deps.domainEventSink || !deps.paymentRefunds) {
    return err(new PaymentProviderError("Payment refund persistence is not configured", 500));
  }

  const context: StaffRefundContext = {
    paymentId,
    adminUserId,
    via: "admin_manual_review",
    eventReason: "seller_archived",
    ...(reason ? { staffReason: reason } : {}),
    sourceEventId: `admin_manual_review_refund:${paymentId}`,
    clawbackNote: `Manual review refund: ${paymentId}`,
    logViaField: true,
  };
  let stripeRefundId: string | null = null;
  if (p.stripeChargeId && deps.stripePayments?.isConfigured()) {
    let refundOutcome: Awaited<
      ReturnType<NonNullable<PaymentServiceDeps["stripePayments"]>["createRefund"]>
    >;
    try {
      refundOutcome = await deps.stripePayments.createRefund({
        chargeId: p.stripeChargeId,
        amount: gbpAmountToPence(p.amount),
        reason: "requested_by_customer",
        ...groupedRefundRef(p),
      });
    } catch (e) {
      return err(paymentProviderErrorFromUnknown(e));
    }
    const deferred = await deferUnlessRefundSucceeded(deps.refundWatch ?? null, {
      chargeId: p.stripeChargeId,
      outcome: refundOutcome,
      context,
    });
    if (deferred) return deferred;
    stripeRefundId = refundOutcome.kind === "created" ? refundOutcome.refundId : null;
  }

  return executePaymentRefundLedger(
    {
      payments: deps.payments,
      paymentRefunds: deps.paymentRefunds,
      transactionRunner: deps.transactionRunner,
      domainEventSink: deps.domainEventSink,
      payoutAdjustments: deps.payoutAdjustments,
      paymentRefundReconcile: deps.paymentRefundReconcile,
      xeroPaymentRecorder: deps.xeroPaymentRecorder,
    },
    { ...context, payment: p, stripeRefundId },
  );
}

/**
 * A staff refund Stripe had not finished when it was made has now succeeded (the refund reconcile
 * job saw it): it is recorded exactly as it would have been then, under the same keys. If the
 * webhooks recorded the refund first the payment is already refunded and nothing more is written.
 */
export async function completeDeferredStaffRefund(
  deps: PaymentServiceDeps,
  context: StaffRefundContext,
  stripeRefundId: string,
): Promise<Result<void, AuthzError | PaymentProviderError>> {
  const p = await deps.payments.findById(context.paymentId);
  if (!p) return err(new AuthzError("Payment not found", 404));
  if (p.status === "refunded") return ok(undefined);
  if (!deps.transactionRunner || !deps.domainEventSink || !deps.paymentRefunds) {
    return err(new PaymentProviderError("Payment refund persistence is not configured", 500));
  }
  return executePaymentRefundLedger(
    {
      payments: deps.payments,
      paymentRefunds: deps.paymentRefunds,
      transactionRunner: deps.transactionRunner,
      domainEventSink: deps.domainEventSink,
      payoutAdjustments: deps.payoutAdjustments,
      paymentRefundReconcile: deps.paymentRefundReconcile,
      xeroPaymentRecorder: deps.xeroPaymentRecorder,
    },
    { ...context, payment: p, stripeRefundId },
  );
}
