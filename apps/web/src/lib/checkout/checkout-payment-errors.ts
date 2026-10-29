import type { ManualReviewReason, PaymentStatus } from "@auction/types";

/** Maps API payment/checkout error codes to buyer-facing copy. */
export function checkoutPaymentErrorMessage(message: string, code?: string | null): string {
  switch (code) {
    case "payment_amount_exceeds_limit":
      return "This amount exceeds the online payment limit. Contact settlements to complete payment.";
    case "invalid_payment_amount":
      return "We could not calculate a valid payment amount for this lot. Contact support.";
    case "stripe_checkout_already_complete":
      return "Checkout is already complete. Payment confirmation may take a few minutes, so refresh this page.";
    case "stripe_checkout_unavailable":
      return "Secure checkout is temporarily unavailable. Try again shortly or contact settlements.";
    case "accounting_unavailable":
      return "We could not prepare your invoice right now. Try again in a few minutes or contact settlements.";
    case "session_required":
      return "Your session expired. Sign in again to complete checkout.";
    case "onboarding_required":
      return "Finish setting up your account before completing checkout.";
    case "payment_intent_amount_mismatch":
      return "Payment could not be verified against your invoice total. Contact settlements.";
    case "address_not_found":
      return "That address was not found. Choose another saved address or add a new one.";
    case "address_not_eligible":
      return "Choose a shipping or billing & shipping address for checkout.";
    case "address_service_unavailable":
      return "We could not verify your address. Try again in a moment.";
    case "payment_checkout_blocked_aml_hold":
      return "Checkout is blocked while we complete a routine compliance review. Our team will contact you with next steps.";
    case "payment_checkout_blocked_source_of_funds":
      return "Checkout is blocked until source-of-funds verification is complete. Our compliance team will contact you with secure instructions.";
    default:
      return message;
  }
}

export function manualReviewReasonCopy(
  reason:
    | "seller_archived"
    | "high_value"
    | "seller_archived_and_high_value"
    | "aml_hold"
    | "source_of_funds_required"
    | "finance_release_required"
    | null
    | undefined,
): string {
  switch (reason) {
    case "seller_archived":
      return "Our team checks this payment before you can pay, because the seller's account has closed. Settlements will contact you with payment instructions.";
    case "high_value":
      return "Our team checks high-value purchases before checkout opens. Settlements will contact you shortly.";
    case "seller_archived_and_high_value":
      return "Our team checks this payment before you can pay, because of its value and the seller's account. Settlements will contact you with next steps.";
    case "aml_hold":
      return "This purchase is on hold while we complete a routine compliance review. Settlement cannot proceed until this is resolved. If you have questions, contact support using the details below — please do not send unsolicited documents.";
    case "source_of_funds_required":
      return "Before settlement we need to verify the source of funds for this purchase. Our compliance team will contact you with secure instructions. Typical documents include recent bank statements, proof of sale proceeds, or inheritance/ gift documentation where applicable.";
    case "finance_release_required":
      return "Our team checks your invoice before it can be paid. Once they have, you can pay here; refresh this page after you hear from us.";
    default:
      return "Your payment is set up. Our team will open checkout or contact you with payment instructions.";
  }
}

/** Buyer-facing manual-review reason for checkout when server omits a specific reason. */
export function resolveCheckoutManualReviewDisplayReason(input: {
  submitted: boolean;
  submittedReviewReason: ManualReviewReason | null;
  openPaymentStatus: PaymentStatus | null | undefined;
  openPaymentManualReviewReason: ManualReviewReason | null | undefined;
  preflightComplianceGate: "clear" | "aml_hold" | "source_of_funds_required" | null | undefined;
}): ManualReviewReason | null {
  if (input.submitted && input.submittedReviewReason) {
    return input.submittedReviewReason;
  }
  if (input.submitted) return null;
  if (input.openPaymentStatus === "requires_manual_review") {
    return input.openPaymentManualReviewReason ?? "finance_release_required";
  }
  if (
    input.openPaymentManualReviewReason === "aml_hold" ||
    input.openPaymentManualReviewReason === "source_of_funds_required"
  ) {
    return input.openPaymentManualReviewReason;
  }
  if (
    input.preflightComplianceGate === "aml_hold" ||
    input.preflightComplianceGate === "source_of_funds_required"
  ) {
    return input.preflightComplianceGate;
  }
  return null;
}
