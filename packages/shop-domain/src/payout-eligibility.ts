export type PayoutLedgerEligibilityInput = {
  status: "pending_refund_period" | "due" | "paid" | "cancelled";
  blockedReason: string | null;
  cancellationPeriodEndsAt: Date | null;
  fundsAvailableAt: Date | null;
  payeeComplianceBlocked: boolean;
  now: Date;
};

export type PayoutEligibilityDecision =
  | { eligible: true; nextStatus: "due" }
  | { eligible: false; reason: PayoutIneligibleReason };

export type PayoutIneligibleReason =
  | "wrong_status"
  | "blocked"
  | "cancellation_period_open"
  | "funds_not_available"
  | "payee_compliance";

export function evaluatePayoutEligibility(
  input: PayoutLedgerEligibilityInput,
): PayoutEligibilityDecision {
  if (input.status !== "pending_refund_period") {
    return { eligible: false, reason: "wrong_status" };
  }
  if (input.blockedReason) {
    return { eligible: false, reason: "blocked" };
  }
  if (input.payeeComplianceBlocked) {
    return { eligible: false, reason: "payee_compliance" };
  }
  if (input.cancellationPeriodEndsAt !== null && input.now < input.cancellationPeriodEndsAt) {
    return { eligible: false, reason: "cancellation_period_open" };
  }
  if (input.fundsAvailableAt !== null && input.now < input.fundsAvailableAt) {
    return { eligible: false, reason: "funds_not_available" };
  }
  return { eligible: true, nextStatus: "due" };
}
