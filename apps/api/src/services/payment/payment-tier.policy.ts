/** Stripe GBP minimum charge (30 pence). */
export const STRIPE_GBP_MIN_PENCE = 30;

export type PaymentTierKind = "card" | "bank_transfer" | "blocked" | "invalid_amount";

export type ManualReviewReason =
  | "seller_archived"
  | "high_value"
  | "seller_archived_and_high_value"
  | "aml_hold"
  | "source_of_funds_required";

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

export class PaymentTierPolicy {
  constructor(private readonly limits: PaymentTierLimits) {}

  get limitsSnapshot(): PaymentTierLimits {
    return this.limits;
  }

  needsManualReviewGate(amountPence: number, sellerArchived: boolean): boolean {
    return needsManualReviewGate(amountPence, this.limits, sellerArchived);
  }

  resolveManualReviewReason(
    amountPence: number,
    sellerArchived: boolean,
  ): ManualReviewReason | null {
    return resolveManualReviewReason(amountPence, this.limits, sellerArchived);
  }

  validateCheckoutAmountPence(amountPence: number): "ok" | "invalid_amount" | "blocked" {
    return validateCheckoutAmountPence(amountPence, this.limits);
  }

  resolveCheckoutRail(amountPence: number): CheckoutRailKind | null {
    return resolveCheckoutRail(amountPence, this.limits);
  }
}
