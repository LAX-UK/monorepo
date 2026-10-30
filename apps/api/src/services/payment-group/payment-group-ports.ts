import type { CheckoutRailKind } from "@auction/domain";

/** One invoice as it appears on the combined checkout. */
export type GroupCheckoutLine = {
  paymentId: string;
  lotId: string;
  lotTitle: string;
  lotNumber: number | null;
  amountPence: number;
};

export type CreateGroupCheckoutInput = {
  paymentGroupId: string;
  rail: CheckoutRailKind;
  currency: string;
  totalPence: number;
  lines: readonly GroupCheckoutLine[];
  buyerEmail: string;
  /** The Stripe customer that receives the bank transfer; required for `gb_bank_transfer`. */
  stripeCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
};

export type GroupCheckoutSession = {
  sessionId: string;
  url: string;
  paymentIntentId: string | null;
};

export type GroupChargeRefund = {
  /** The invoice's payment the refund names, `null` when it names none. */
  paymentId: string | null;
  amountPence: number;
};

/**
 * The payment provider's side of a combined payment: one hosted checkout for the group, ending it
 * early, and reading the refunds made against the group's charge.
 */
export interface IPaymentGroupGateway {
  isConfigured(): boolean;
  /**
   * Creates (or returns, on a retry) the group's checkout. Idempotent per group and rail: the same
   * group never gets two checkouts.
   */
  createCheckout(input: CreateGroupCheckoutInput): Promise<GroupCheckoutSession>;
  /** Expires the checkout so it can no longer be paid; a finished one is left as it is. */
  expireCheckout(sessionId: string): Promise<void>;
  /** Every refund that went through, or is going through, against the charge. */
  listChargeRefunds(chargeId: string): Promise<GroupChargeRefund[]>;
}
