/** Maps API payment/checkout error codes to buyer-facing copy. */
export function checkoutPaymentErrorMessage(message: string, code?: string | null): string {
  switch (code) {
    case "payment_amount_exceeds_limit":
      return "This amount exceeds the online payment limit. Contact settlements to complete payment.";
    case "invalid_payment_amount":
      return "We could not calculate a valid payment amount for this lot. Contact support.";
    case "stripe_checkout_already_complete":
      return "Stripe checkout is already complete. Payment confirmation may take a few minutes — refresh this page.";
    case "stripe_checkout_unavailable":
      return "Secure checkout is temporarily unavailable. Try again shortly or contact settlements.";
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
    | null
    | undefined,
): string {
  switch (reason) {
    case "seller_archived":
      return "This lot requires finance review because the seller account is archived. Settlements will contact you with payment instructions.";
    case "high_value":
      return "This high-value purchase requires finance review before Stripe checkout is issued. Settlements will contact you shortly.";
    case "seller_archived_and_high_value":
      return "This lot requires finance review (high value and seller status). Settlements will contact you with next steps.";
    case "aml_hold":
      return "This purchase is on hold while we complete a routine compliance review. Settlement cannot proceed until this is resolved. If you have questions, contact support using the details below — please do not send unsolicited documents.";
    case "source_of_funds_required":
      return "Before settlement we need to verify the source of funds for this purchase. Our compliance team will contact you with secure instructions. Typical documents include recent bank statements, proof of sale proceeds, or inheritance/ gift documentation where applicable.";
    default:
      return "Your payment record was created. Finance will issue checkout or contact you with payment instructions.";
  }
}
