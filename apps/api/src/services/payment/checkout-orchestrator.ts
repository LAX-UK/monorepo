import type { IPaymentDomainEventsRepository } from "@auction/persistence/interfaces";
import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import type { IPaymentWriteRepository } from "@auction/persistence/interfaces";
import type { IUserRepository } from "@auction/persistence/interfaces";
import type { Lot } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import { PaymentProviderError } from "../../lib/errors.js";
import { recordMoneyPathEvent } from "../../middleware/metrics.js";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import type { IStripeCheckoutService } from "../interfaces/checkout-rail.js";
import type { IInvoiceAccountingProvider } from "../interfaces/invoice-accounting.js";
import type { IStripePaymentGateway } from "../stripe/stripe-payment-gateway.js";
import { ensureXeroInvoiceForPayment } from "./ensure-xero-invoice.js";
import type {
  CheckoutRailKind,
  ManualReviewReason,
  PaymentTierPolicy,
} from "./payment-tier.policy.js";
import { manualReviewReasonFromCheckoutBlockCode } from "./resolve-manual-review-reason.js";

export type CheckoutOrchestratorDeps = {
  payments: IPaymentWriteRepository;
  users: IUserRepository;
  accounting: IInvoiceAccountingProvider;
  stripeCheckout: IStripeCheckoutService | null;
  stripePayments: IStripePaymentGateway | null;
  settlementCompliance: ISettlementCompliancePolicy | null;
  paymentTierPolicy: PaymentTierPolicy;
  legalEntityRepository?: ILegalEntityRepository | undefined;
  paymentEvents: IPaymentDomainEventsRepository | null;
  xeroInvoiceBlocking: boolean;
};

export async function revokeOpenStripeCheckoutForPayment(
  deps: CheckoutOrchestratorDeps,
  paymentId: string,
): Promise<void> {
  if (!deps.stripePayments?.isConfigured()) return;
  const row = await deps.payments.findById(paymentId);
  if (!row) return;
  try {
    await deps.stripePayments.revokeOpenCheckoutForPayment(paymentId, row.stripePaymentIntentId);
    recordMoneyPathEvent("stripe_checkout_revoked_for_manual_review");
  } catch (err) {
    recordMoneyPathEvent("stripe_checkout_revoke_failed");
    console.error(
      JSON.stringify({
        msg: "stripe_checkout_revoke_failed",
        paymentId,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

export async function resolvePendingCheckoutManualReviewReason(
  deps: CheckoutOrchestratorDeps,
  paymentId: string,
  lot: Lot,
  buyerId: string,
  amount: string,
): Promise<ManualReviewReason | null> {
  const amountPence = gbpAmountToPence(amount);
  if (deps.settlementCompliance) {
    const compliance = await deps.settlementCompliance.evaluate({
      buyerUserId: buyerId,
      amountPence,
      excludePaymentId: paymentId,
    });
    if (compliance.hold && compliance.reason) {
      return compliance.reason;
    }
  }
  const sellerLegalEntityId = lot.sellerLegalEntityId;
  const sellerEntity =
    deps.legalEntityRepository && sellerLegalEntityId
      ? await deps.legalEntityRepository.findById(sellerLegalEntityId)
      : null;
  const sellerArchived = sellerEntity?.status === "archived";
  if (sellerArchived) {
    return deps.paymentTierPolicy.resolveManualReviewReason(amountPence, sellerArchived);
  }
  return null;
}

export async function promotePendingToComplianceManualReview(
  deps: CheckoutOrchestratorDeps,
  paymentId: string,
  lot: Lot,
  buyerId: string,
  amount: string,
  reason: ManualReviewReason,
): Promise<{
  checkoutUrl: null;
  checkoutRail: null;
  manualReviewReason: ManualReviewReason;
}> {
  await revokeOpenStripeCheckoutForPayment(deps, paymentId);
  await deps.payments.updateStatus(paymentId, "requires_manual_review");
  if (deps.paymentEvents) {
    await deps.paymentEvents.publish({
      aggregateType: "payment",
      aggregateId: paymentId,
      eventType: "payment.requires_manual_review",
      payload: {
        paymentId,
        lotId: lot.id,
        buyerUserId: buyerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        amount,
        currency: "GBP",
        reason,
      },
      actorUserId: buyerId,
      actingLegalEntityId: lot.buyerLegalEntityId ?? null,
    });
  }
  recordMoneyPathEvent(`settlement_compliance_hold_${reason}`);
  return { checkoutUrl: null, checkoutRail: null, manualReviewReason: reason };
}

export async function issueCheckoutForPendingPayment(
  deps: CheckoutOrchestratorDeps,
  paymentId: string,
  lot: Lot,
  buyerId: string,
  amount: string,
): Promise<
  Result<
    { checkoutUrl: string | null; checkoutRail: CheckoutRailKind | null },
    PaymentProviderError
  >
> {
  const amountPence = gbpAmountToPence(amount);
  if (deps.settlementCompliance) {
    const compliance = await deps.settlementCompliance.evaluate({
      buyerUserId: buyerId,
      amountPence,
      excludePaymentId: paymentId,
    });
    if (compliance.hold) {
      const code =
        compliance.reason === "aml_hold"
          ? "payment_checkout_blocked_aml_hold"
          : "payment_checkout_blocked_source_of_funds";
      const message =
        compliance.reason === "aml_hold"
          ? "Checkout is blocked pending AML/sanctions compliance review."
          : "Checkout is blocked until source-of-funds review is complete.";
      return err(new PaymentProviderError(message, 403, code));
    }
  }
  const validation = deps.paymentTierPolicy.validateCheckoutAmountPence(amountPence);
  if (validation === "blocked") {
    return err(
      new PaymentProviderError(
        "Payment amount exceeds the maximum online payment limit",
        400,
        "payment_amount_exceeds_limit",
      ),
    );
  }
  if (validation === "invalid_amount") {
    return err(new PaymentProviderError("Invalid payment amount", 400, "invalid_payment_amount"));
  }

  const invoiceResult = await ensureXeroInvoiceForPayment(
    deps.accounting,
    deps.users,
    paymentId,
    lot,
    buyerId,
    amount,
  );
  if (!invoiceResult.ok) {
    if (deps.xeroInvoiceBlocking) {
      return err(
        new PaymentProviderError(
          invoiceResult.error ?? "Accounting invoice unavailable",
          503,
          "accounting_unavailable",
        ),
      );
    }
    // Non-blocking: the payment is the source of truth. The `payment_external_ref` row is left
    // pending/error and the `retry-xero-invoice-creation` cron creates the invoice once Xero is
    // healthy. Buyers are never blocked by a stale Xero connection.
    recordMoneyPathEvent("xero_invoice_deferred");
  }

  if (!deps.stripeCheckout?.isAvailable()) {
    return err(
      new PaymentProviderError(
        "Stripe checkout is not configured",
        503,
        "stripe_checkout_unavailable",
      ),
    );
  }

  const rail = deps.paymentTierPolicy.resolveCheckoutRail(amountPence);
  if (!rail) {
    return err(
      new PaymentProviderError(
        "Checkout is not available for this amount",
        400,
        "invalid_payment_amount",
      ),
    );
  }

  const buyer = await deps.users.findById(buyerId);
  if (!buyer?.email) {
    return err(new PaymentProviderError("Buyer email is required for checkout", 400));
  }
  if (!lot.buyerLegalEntityId) {
    return err(new PaymentProviderError("Buyer legal entity is required for checkout", 400));
  }

  const checkout = await deps.stripeCheckout.createCheckout(rail, {
    paymentId,
    lot,
    buyerEmail: buyer.email,
    buyerName: buyer.name,
    amount,
    buyerLegalEntityId: lot.buyerLegalEntityId,
    amountPence,
  });

  if (!checkout.checkoutUrl) {
    return err(
      new PaymentProviderError(
        checkout.error ?? "Failed to create Stripe checkout session",
        502,
        checkout.errorCode ?? "stripe_checkout_unavailable",
      ),
    );
  }

  return ok({
    checkoutUrl: checkout.checkoutUrl,
    checkoutRail: checkout.checkoutRail,
  });
}

export async function resolveCheckoutForPendingOrPromoteCompliance(
  deps: CheckoutOrchestratorDeps,
  paymentId: string,
  lot: Lot,
  buyerId: string,
  amount: string,
): Promise<
  Result<
    {
      checkoutUrl: string | null;
      checkoutRail: CheckoutRailKind | null;
      manualReviewReason: ManualReviewReason | null;
    },
    PaymentProviderError
  >
> {
  const manualReviewReason = await resolvePendingCheckoutManualReviewReason(
    deps,
    paymentId,
    lot,
    buyerId,
    amount,
  );
  if (manualReviewReason) {
    return ok(
      await promotePendingToComplianceManualReview(
        deps,
        paymentId,
        lot,
        buyerId,
        amount,
        manualReviewReason,
      ),
    );
  }

  const checkout = await issueCheckoutForPendingPayment(deps, paymentId, lot, buyerId, amount);
  if (checkout.isOk()) {
    return ok({
      checkoutUrl: checkout.value.checkoutUrl,
      checkoutRail: checkout.value.checkoutRail,
      manualReviewReason: null,
    });
  }
  const reason = manualReviewReasonFromCheckoutBlockCode(checkout.error.stripeCode);
  if (reason) {
    return ok(
      await promotePendingToComplianceManualReview(deps, paymentId, lot, buyerId, amount, reason),
    );
  }
  return err(checkout.error);
}
