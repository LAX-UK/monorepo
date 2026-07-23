import type { ManualReviewReason } from "@auction/domain";
import type { PaymentTierPolicy } from "./payment-tier.policy.js";
import type { ISettlementCompliancePolicy } from "./settlement-compliance.policy.js";

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
