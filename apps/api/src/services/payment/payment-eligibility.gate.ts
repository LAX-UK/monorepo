export {
  type IPaymentEligibilityGate,
  PaymentEligibilityGate,
  type PaymentEligibilityGateOptions,
  createPaymentEligibilityGate,
  paymentsAreLive,
} from "@auction/finance-runtime";

/** What a refusal tells the payer; the same for both ways of paying. */
export const PAYMENT_ELIGIBILITY_REFUSAL = {
  organisation_closed: {
    message: "This account is closed, so it cannot pay. Contact us about this purchase.",
    status: 403,
  },
} as const;

/** What a hold tells the payer when they try to pay several invoices at once. */
export const PAYMENT_ELIGIBILITY_HOLD = {
  identity_verification_required: {
    message: "Verify your identity, then you can pay. Your invoices stay as they are meanwhile.",
    status: 409,
  },
  organisation_under_review: {
    message:
      "We are still checking your organisation. You can pay once we have; we will let you know.",
    status: 409,
  },
} as const;
