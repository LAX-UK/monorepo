import type { ManualReviewReason } from "@auction/domain";

export type SettlementComplianceDecision = {
  hold: boolean;
  reason: ManualReviewReason | null;
};

export interface ISettlementCompliancePolicy {
  evaluate(input: {
    buyerUserId: string;
    amountPence: number;
    excludePaymentId?: string;
  }): Promise<SettlementComplianceDecision>;
}
