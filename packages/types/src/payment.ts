import type { Lot } from "./lot.js";

export const paymentStatuses = [
  "pending",
  "authorized",
  "captured",
  "refunded",
  "requires_manual_review",
  "cancelled",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

/** Payment - symmetric buyer/seller with legal entity refs */
export type Payment = {
  id: string;
  lotId: string;
  /** Transitional compatibility only; new API mappers do not emit this field. */
  buyerId?: string;
  /** Transitional compatibility only; new API mappers do not emit this field. */
  sellerId?: string;
  buyerLegalEntityId?: string | undefined;
  sellerLegalEntityId?: string | undefined;
  amount: string;
  platformFee: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeRefundId: string | null;
  status: PaymentStatus;
  createdAt: Date;
};

/** Response from `POST /payments` (checkout). */
export type CheckoutRailKind = "card" | "gb_bank_transfer";

export type ManualReviewReason =
  | "seller_archived"
  | "high_value"
  | "seller_archived_and_high_value"
  | "aml_hold"
  | "source_of_funds_required";

export type CreatePaymentResponse = {
  paymentId: string;
  checkoutUrl: string | null;
  checkoutRail?: CheckoutRailKind | null;
  manualReviewReason?: ManualReviewReason | null;
  marketingEventId?: string;
};

/** Winner portfolio row from `GET /users/me/portfolio`. */
export type PortfolioRow = {
  lot: Lot;
  payment: { id: string; status: PaymentStatus } | null;
};
