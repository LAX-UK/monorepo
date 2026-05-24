import type { Lot } from "@auction/types";

export type PaymentCheckoutContext = {
  paymentId: string;
  lot: Lot;
  buyerEmail: string;
  buyerName: string;
  amount: string;
  buyerLegalEntityId?: string;
};

export type PaymentCheckoutResult = {
  checkoutUrl: string | null;
  /** When set, buyer should use Stripe Checkout (card). When false, Xero invoice (bank transfer). */
  provider?: "stripe" | "xero";
  error?: string;
};

export interface IPaymentCheckoutProvider {
  /** Lower priority number = tried first. */
  readonly priority: number;
  isAvailable(): boolean;
  createCheckout(ctx: PaymentCheckoutContext): Promise<PaymentCheckoutResult>;
}
