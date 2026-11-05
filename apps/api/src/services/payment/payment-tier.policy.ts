/** The one implementation lives in `@auction/finance-runtime`, shared with the worker. */
export { PaymentTierPolicy } from "@auction/finance-runtime";
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
