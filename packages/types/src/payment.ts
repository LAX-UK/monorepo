import type { Lot } from "./lot.js";

/** Calendar days from invoice creation until payment is due (terms §13). */
export const INVOICE_PAYMENT_DUE_DAYS = 7;

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
  | "source_of_funds_required"
  /** Compliance/tier checks passed; finance must release before Stripe checkout. */
  | "finance_release_required"
  /** A personal buyer verifies their identity first; the invoice stays owed meanwhile. */
  | "identity_verification_required"
  /** LAX is still checking the organisation; its invoices can be paid once it has. */
  | "organisation_under_review";

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
  payment: {
    id: string;
    status: PaymentStatus;
    manualReviewReason: ManualReviewReason | null;
    /** ISO-8601 timestamp when the payment row was created (invoice date). */
    createdAt?: string;
  } | null;
};

/**
 * What one line of an invoice charges for. VAT, import VAT and Artist's Resale Right lines are
 * kept in the contract so the page, Stripe and the invoice PDF can show them later; no amount is
 * stored for them until the accountant has confirmed the rules.
 */
export const invoiceLineKinds = [
  "hammer",
  "buyers_premium",
  "vat_on_hammer",
  "import_vat",
  "artists_resale_right",
  "delivery",
  /** One line for the whole total, on an invoice raised before its parts were stored. */
  "legacy_total",
] as const;
export type InvoiceLineKind = (typeof invoiceLineKinds)[number];

/** One stored line of an invoice. Money is whole pence in pounds sterling. */
export type InvoiceLine = {
  kind: InvoiceLineKind;
  label: string;
  /** The rate the amount was worked out at ("25", "12.5"), or `null` when it is not a rate. */
  ratePercent: string | null;
  amountPence: number;
};

/** How an invoice came to exist. */
export const invoiceSources = ["raised", "legacy_backfill"] as const;
export type InvoiceSource = (typeof invoiceSources)[number];
