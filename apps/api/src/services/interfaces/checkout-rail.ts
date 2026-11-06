import type { InvoiceLine, Lot } from "@auction/types";
import type { CheckoutRailKind } from "../payment/payment-tier.policy.js";

export type PaymentCheckoutContext = {
  paymentId: string;
  lot: Lot;
  buyerEmail: string;
  buyerName: string;
  amount: string;
  buyerLegalEntityId: string;
  amountPence: number;
  /** The invoice's stored lines; they add up to `amountPence`. */
  invoiceLines: readonly InvoiceLine[];
};

export type PaymentCheckoutResult = {
  checkoutUrl: string | null;
  checkoutRail: CheckoutRailKind | null;
  error?: string;
  errorCode?: string;
};

export interface ICheckoutRail {
  readonly kind: CheckoutRailKind;
  createCheckout(ctx: PaymentCheckoutContext): Promise<PaymentCheckoutResult>;
}

export interface IStripeCheckoutService {
  isAvailable(): boolean;
  createCheckout(
    rail: CheckoutRailKind,
    ctx: PaymentCheckoutContext,
  ): Promise<PaymentCheckoutResult>;
}
