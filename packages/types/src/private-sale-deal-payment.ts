/**
 * The buyer's payment for a private sale deal, taken through the same card and bank transfer
 * rails as a lot invoice. Money is in pence, GBP only.
 */

/**
 * `open` (checkout issued) -> `processing` (bank transfer on its way) -> `paid`; `open` or
 * `processing` -> `cancelled` when the checkout is cancelled, expires or fails; `paid` ->
 * `refunded` once the money has gone back to the buyer.
 */
export const PRIVATE_SALE_PAYMENT_STATUSES = [
  "open",
  "processing",
  "paid",
  "cancelled",
  "refunded",
] as const;
export type PrivateSalePaymentStatus = (typeof PRIVATE_SALE_PAYMENT_STATUSES)[number];

export const PRIVATE_SALE_PAYMENT_RAILS = ["card", "gb_bank_transfer"] as const;
export type PrivateSalePaymentRail = (typeof PRIVATE_SALE_PAYMENT_RAILS)[number];

export type PrivateSaleDealPayment = {
  id: string;
  dealId: string;
  buyerLegalEntityId: string;
  /** The member who opened the checkout; receives the receipt. */
  createdByUserId: string | null;
  status: PrivateSalePaymentStatus;
  rail: PrivateSalePaymentRail;
  currency: "GBP";
  /** What the checkout charges: the price plus any buyer's fee. */
  amountMinor: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  /** Set once the money has been returned. */
  refundedMinor: number;
  stripeRefundId: string | null;
  paidAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A released, paid deal as the payout run reads it. Money is in pence. */
export type PrivateSalePayoutDeal = {
  dealId: string;
  reference: string;
  sellerLegalEntityId: string;
  priceMinor: number;
  sellerCommissionBps: number;
  costsMinor: number;
};
