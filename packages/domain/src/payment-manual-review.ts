import type { ManualReviewReason } from "./payment-tier-policy.js";

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
