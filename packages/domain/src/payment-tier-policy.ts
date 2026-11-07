/** Stripe GBP minimum charge (30 pence). */
export const STRIPE_GBP_MIN_PENCE = 30;

export type PaymentTierKind = "card" | "bank_transfer" | "blocked" | "invalid_amount";

export type ManualReviewReason =
  | "seller_archived"
  | "high_value"
  | "seller_archived_and_high_value"
  | "aml_hold"
  | "source_of_funds_required"
  | "finance_release_required"
  /** Held for the account, not reviewed by staff: see `paymentEligibility`. */
  | "identity_verification_required"
  | "organisation_under_review";

export type PaymentTierLimits = {
  cardMaxPence: number;
  manualReviewMinPence: number;
  absoluteMaxPence: number;
  minPence: number;
};

export type CheckoutRailKind = "card" | "gb_bank_transfer";

export function majorGbpToPence(major: number): number {
  return Math.round(major * 100);
}

export function parsePaymentTierLimits(env: {
  STRIPE_CARD_CHECKOUT_MAX: number;
  STRIPE_MANUAL_REVIEW_MIN: number;
  STRIPE_ABSOLUTE_MAX: number;
}): PaymentTierLimits {
  return {
    cardMaxPence: majorGbpToPence(env.STRIPE_CARD_CHECKOUT_MAX),
    manualReviewMinPence: majorGbpToPence(env.STRIPE_MANUAL_REVIEW_MIN),
    absoluteMaxPence: majorGbpToPence(env.STRIPE_ABSOLUTE_MAX),
    minPence: STRIPE_GBP_MIN_PENCE,
  };
}

/** Whether checkout must wait for finance review before a Stripe URL is issued. */
export function needsManualReviewGate(
  amountPence: number,
  limits: PaymentTierLimits,
  sellerArchived: boolean,
): boolean {
  return sellerArchived || amountPence >= limits.manualReviewMinPence;
}

export function resolveManualReviewReason(
  amountPence: number,
  limits: PaymentTierLimits,
  sellerArchived: boolean,
): ManualReviewReason | null {
  const highValue = amountPence >= limits.manualReviewMinPence;
  if (sellerArchived && highValue) return "seller_archived_and_high_value";
  if (sellerArchived) return "seller_archived";
  if (highValue) return "high_value";
  return null;
}

/** Validates amount for any online checkout; returns null when out of bounds. */
export function validateCheckoutAmountPence(
  amountPence: number,
  limits: PaymentTierLimits,
): "ok" | "invalid_amount" | "blocked" {
  if (amountPence < limits.minPence) return "invalid_amount";
  if (amountPence > limits.absoluteMaxPence) return "blocked";
  return "ok";
}

export type PaymentMethodAvailability = {
  method: "card" | "bank_transfer";
  available: boolean;
  /** Why it is unavailable; `null` while it is available. */
  reason: "over_card_limit" | "over_online_limit" | null;
};

/** How a payer chooses to pay on the Pay page. */
export type ChosenPaymentMethod = PaymentMethodAvailability["method"];

/**
 * How a total can be paid. Card takes up to and including the card limit; UK bank transfer takes
 * any amount an online payment can. Neither takes more than one online payment can.
 */
export function paymentMethodsFor(
  totalPence: number,
  limits: PaymentTierLimits,
): PaymentMethodAvailability[] {
  const overOnlineLimit = totalPence > limits.absoluteMaxPence;
  const overCardLimit = totalPence > limits.cardMaxPence;
  return [
    {
      method: "card",
      available: !overCardLimit,
      reason: overCardLimit ? (overOnlineLimit ? "over_online_limit" : "over_card_limit") : null,
    },
    {
      method: "bank_transfer",
      available: !overOnlineLimit,
      reason: overOnlineLimit ? "over_online_limit" : null,
    },
  ];
}

/**
 * The Stripe rail for the method the payer chose, or why it cannot be used. Card above the card
 * limit is refused here, on the server, whatever the page asked for.
 */
export function resolveChosenRail(
  method: ChosenPaymentMethod,
  amountPence: number,
  limits: PaymentTierLimits,
): { rail: CheckoutRailKind } | { refusal: "card_over_limit" | "below_minimum" | "over_limit" } {
  const validation = validateCheckoutAmountPence(amountPence, limits);
  if (validation === "invalid_amount") return { refusal: "below_minimum" };
  if (validation === "blocked") return { refusal: "over_limit" };
  if (method === "bank_transfer") return { rail: "gb_bank_transfer" };
  return amountPence > limits.cardMaxPence ? { refusal: "card_over_limit" } : { rail: "card" };
}

/** Stripe Checkout rail for a pending payment that is cleared for checkout. */
export function resolveCheckoutRail(
  amountPence: number,
  limits: PaymentTierLimits,
): CheckoutRailKind | null {
  const validation = validateCheckoutAmountPence(amountPence, limits);
  if (validation !== "ok") return null;
  if (amountPence > limits.cardMaxPence) return "gb_bank_transfer";
  return "card";
}
