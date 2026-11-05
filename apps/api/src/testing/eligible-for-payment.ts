import type { IPaymentEligibilityGate } from "../services/payment/payment-eligibility.gate.js";

/**
 * An eligibility gate for tests about checkout itself rather than the account: every account may
 * pay. Closed organisations and identity are covered by the gate's and the domain rule's tests.
 */
export const eligibleForPaymentInTests: IPaymentEligibilityGate = {
  refusal: async () => null,
};
