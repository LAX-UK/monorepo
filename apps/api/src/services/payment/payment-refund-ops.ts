import { type UserRole, normalizeUserStaffRole, roleHasCapability } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { AuthzError, PaymentProviderError } from "../../lib/errors.js";
import { paymentProviderErrorFromUnknown } from "./payment-service-errors.js";
import { type PaymentServiceDeps, REFUND_BLOCKED_STATUSES } from "./payment-service-types.js";
import { executePaymentRefundLedger } from "./refund-execution.js";

export async function refundPayment(
  deps: PaymentServiceDeps,
  adminUserId: string,
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
  if (!deps.db || !deps.domainEventPublisher) {
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
    });
  } catch (e) {
    return err(paymentProviderErrorFromUnknown(e));
  }

  const stripeRefundId = refundOutcome.kind === "created" ? refundOutcome.refundId : null;

  return executePaymentRefundLedger(
    {
      payments: deps.payments,
      db: deps.db,
      domainEventPublisher: deps.domainEventPublisher,
      payoutAdjustments: deps.payoutAdjustments,
      paymentRefundReconcile: deps.paymentRefundReconcile,
      xeroPaymentRecorder: deps.xeroPaymentRecorder,
    },
    {
      payment: p,
      adminUserId,
      stripeRefundId,
      via: "admin_manual",
      sourceEventId: `admin_refund:${paymentId}`,
      clawbackNote: `Admin refund: ${paymentId}`,
      logViaField: false,
    },
  );
}

export async function refundManualReviewPayment(
  deps: PaymentServiceDeps,
  adminUserId: string,
  userRole: string,
  paymentId: string,
  userStaffRole?: string | null,
): Promise<Result<void, AuthzError | PaymentProviderError>> {
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
  if (!deps.db || !deps.domainEventPublisher) {
    return err(new PaymentProviderError("Payment refund persistence is not configured", 500));
  }

  let stripeRefundId: string | null = null;
  if (p.stripeChargeId && deps.stripePayments?.isConfigured()) {
    try {
      const refundOutcome = await deps.stripePayments.createRefund({
        chargeId: p.stripeChargeId,
        amount: gbpAmountToPence(p.amount),
        reason: "requested_by_customer",
      });
      stripeRefundId = refundOutcome.kind === "created" ? refundOutcome.refundId : null;
    } catch (e) {
      return err(paymentProviderErrorFromUnknown(e));
    }
  }

  return executePaymentRefundLedger(
    {
      payments: deps.payments,
      db: deps.db,
      domainEventPublisher: deps.domainEventPublisher,
      payoutAdjustments: deps.payoutAdjustments,
      paymentRefundReconcile: deps.paymentRefundReconcile,
      xeroPaymentRecorder: deps.xeroPaymentRecorder,
    },
    {
      payment: p,
      adminUserId,
      stripeRefundId,
      via: "admin_manual_review",
      eventReason: "seller_archived",
      sourceEventId: `admin_manual_review_refund:${paymentId}`,
      clawbackNote: `Manual review refund: ${paymentId}`,
      logViaField: true,
    },
  );
}
