import type { PrivateSalePaymentRail } from "@auction/types";

/** What the buyer is shown and charged on the hosted checkout of a deal. */
export type CreateDealCheckoutInput = {
  paymentId: string;
  dealId: string;
  /** The PS reference the buyer quotes. The work and the parties are never sent to the provider. */
  reference: string;
  rail: PrivateSalePaymentRail;
  currency: "GBP";
  amountPence: number;
  buyerEmail: string;
  /** The Stripe customer that receives the bank transfer; required for `gb_bank_transfer`. */
  stripeCustomerId: string | null;
  successUrl: string;
  cancelUrl: string;
};

export type DealCheckoutSession = {
  sessionId: string;
  url: string;
  paymentIntentId: string | null;
};

/** The payment provider's side of a deal's payment. */
export interface IDealCheckoutGateway {
  isConfigured(): boolean;
  /** Creates (or returns, on a retry) the payment's checkout: one per payment, never per attempt. */
  createCheckout(input: CreateDealCheckoutInput): Promise<DealCheckoutSession>;
  /** Expires the checkout so it can no longer be paid; a finished one is left as it is. */
  expireCheckout(sessionId: string): Promise<void>;
}
