import {
  type CheckoutRailKind,
  type ManualReviewReason,
  type PaymentTierLimits,
  needsManualReviewGate,
  resolveCheckoutRail,
  resolveManualReviewReason,
  validateCheckoutAmountPence,
} from "@auction/domain";

export {
  STRIPE_GBP_MIN_PENCE,
  majorGbpToPence,
  needsManualReviewGate,
  parsePaymentTierLimits,
  resolveCheckoutRail,
  resolveManualReviewReason,
  validateCheckoutAmountPence,
  type CheckoutRailKind,
  type ManualReviewReason,
  type PaymentTierKind,
  type PaymentTierLimits,
} from "@auction/domain";

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

  validateCheckoutAmountPence(amountPence: number) {
    return validateCheckoutAmountPence(amountPence, this.limits);
  }

  resolveCheckoutRail(amountPence: number): CheckoutRailKind | null {
    return resolveCheckoutRail(amountPence, this.limits);
  }
}
