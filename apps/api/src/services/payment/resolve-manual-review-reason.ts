import type { PaymentRecord } from "@auction/persistence/interfaces";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
import type { ManualReviewReason, PaymentTierPolicy } from "./payment-tier.policy.js";

export type ResolveManualReviewReasonInput = {
  buyerUserId: string;
  amountPence: number;
  sellerArchived: boolean;
  paymentTierPolicy: PaymentTierPolicy;
  settlementCompliance: ISettlementCompliancePolicy | null | undefined;
  excludePaymentId?: string;
  paymentStatus?: PaymentRecord["status"];
};

export type ResolveManualReviewReasonResult = {
  manualReviewReason: ManualReviewReason | null;
  complianceHold: boolean;
};

/** Compliance reasons take precedence over value-tier finance review reasons. */
export async function resolveManualReviewReason(
  input: ResolveManualReviewReasonInput,
): Promise<ResolveManualReviewReasonResult> {
  const complianceDecision = input.settlementCompliance
    ? await input.settlementCompliance.evaluate({
        buyerUserId: input.buyerUserId,
        amountPence: input.amountPence,
        ...(input.excludePaymentId ? { excludePaymentId: input.excludePaymentId } : {}),
      })
    : { hold: false, reason: null };

  if (complianceDecision.hold && complianceDecision.reason) {
    return {
      manualReviewReason: complianceDecision.reason,
      complianceHold: true,
    };
  }

  if (input.paymentStatus === "requires_manual_review") {
    const tierReason = input.paymentTierPolicy.resolveManualReviewReason(
      input.amountPence,
      input.sellerArchived,
    );
    if (tierReason) {
      return { manualReviewReason: tierReason, complianceHold: false };
    }
    return { manualReviewReason: "finance_release_required", complianceHold: false };
  }

  return { manualReviewReason: null, complianceHold: false };
}

export function isComplianceCheckoutBlockCode(code: string | undefined): boolean {
  return (
    code === "payment_checkout_blocked_aml_hold" ||
    code === "payment_checkout_blocked_source_of_funds"
  );
}

export function manualReviewReasonFromCheckoutBlockCode(
  code: string | undefined,
): ManualReviewReason | null {
  if (code === "payment_checkout_blocked_aml_hold") return "aml_hold";
  if (code === "payment_checkout_blocked_source_of_funds") return "source_of_funds_required";
  return null;
}

export type NewPaymentReviewDecision = {
  requiresManualReview: boolean;
  manualReviewReason: ManualReviewReason | null;
  complianceHold: boolean;
};

/** Shared gate for creating a payment row (checkout fallback + auto-invoice at lot close). */
export async function resolveNewPaymentReviewDecision(input: {
  buyerUserId: string;
  amountPence: number;
  sellerArchived: boolean;
  paymentTierPolicy: PaymentTierPolicy;
  settlementCompliance: ISettlementCompliancePolicy | null | undefined;
}): Promise<NewPaymentReviewDecision> {
  const complianceDecision = input.settlementCompliance
    ? await input.settlementCompliance.evaluate({
        buyerUserId: input.buyerUserId,
        amountPence: input.amountPence,
      })
    : { hold: false, reason: null };

  const tierNeedsReview = input.paymentTierPolicy.needsManualReviewGate(
    input.amountPence,
    input.sellerArchived,
  );
  const requiresManualReview = complianceDecision.hold || tierNeedsReview;
  const manualReviewReason: ManualReviewReason | null = complianceDecision.hold
    ? complianceDecision.reason
    : tierNeedsReview
      ? input.paymentTierPolicy.resolveManualReviewReason(input.amountPence, input.sellerArchived)
      : null;

  return {
    requiresManualReview,
    manualReviewReason,
    complianceHold: complianceDecision.hold,
  };
}
