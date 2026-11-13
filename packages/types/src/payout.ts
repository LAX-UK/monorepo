/** Payout Status */
export const payoutStatuses = [
  "scheduled",
  "in_transit",
  "paid",
  "failed",
  "reversed",
  "clawback_pending",
  /** Stripe already holds a transfer for this payout that we cannot safely adopt: staff must look. */
  "transfer_blocked",
] as const;
export type PayoutStatus = (typeof payoutStatuses)[number];

/** Payout Line Kind */
export const payoutLineKinds = [
  "sale",
  "refund",
  "dispute",
  "chargeback",
  "platform_credit",
  "adjustment",
  "reversal",
] as const;
export type PayoutLineKind = (typeof payoutLineKinds)[number];

/** Legal Entity Payout Method (Stripe Connect metadata) */
export type LegalEntityPayoutMethod = {
  id: string;
  legalEntityId: string;
  provider: string;
  stripeExternalAccountId: string | null;
  isDefault: boolean;
  status: "active" | "retired";
  createdAt: Date;
  retiredAt: Date | null;
};

/** Payout - settlement run for a legal entity */
export type Payout = {
  id: string;
  legalEntityId: string;
  periodStart: Date;
  periodEnd: Date;
  grossAmount: string;
  platformFee: string;
  stripeFee: string;
  netAmount: string;
  currency: string;
  status: PayoutStatus;
  stripeTransferId: string | null;
  xeroBillId: string | null;
  failureReason: string | null;
  processedAt: Date | null;
  /** cached payout statement PDF URL (Spaces or local). */
  statementUrl: string | null;
  /** populated when PDF generation fails after max retries. */
  statementGenerationError: string | null;
  createdAt: Date;
  /** The seller's display name; filled by list reads, so a list never looks it up per row. */
  legalEntityName?: string | null;
  /**
   * The hammer, commission and VAT on commission of the lot sales on the payout, from their
   * seller-terms snapshots. `null` on payouts made before payouts were paid from the snapshot.
   */
  sellerTermsTotals?: PayoutSellerTermsTotals | null;
};

/** A payout's lot sales split the way the seller-terms snapshot splits each one. */
export type PayoutSellerTermsTotals = {
  hammer: string;
  commission: string;
  commissionVat: string;
};

/** Payout Line - individual line item in a payout */
export type PayoutLine = {
  id: string;
  payoutId: string;
  paymentId: string | null;
  /** The private sale deal a sale line settles, in place of a lot payment. */
  privateSaleDealId?: string | null;
  amount: string;
  kind: PayoutLineKind;
  createdByUserId: string | null;
  note: string | null;
  createdAt: Date;
  /** The seller-terms snapshot a lot's sale line pays; `null` on lines paid under the old rule. */
  sellerTermsId?: string | null;
  /**
   * On a refund line: the buyer's refund, in pence, the line answers for; negative on a line giving
   * back a failed refund (the buyer refund it reverses).
   */
  buyerRefundPence?: number | null;
  /**
   * What a sale line's split is worked from, read with the line. For a line paid from a seller-terms
   * snapshot: the hammer, and the commission plus the VAT on it. For a line paid under the old rule:
   * the buyer's payment and LAX's fee on it.
   */
  payment?: { amount: string; platformFee: string } | null;
};

/** Admin Create Adjustment Input */
export type CreatePayoutAdjustmentInput = {
  amount: string;
  note: string;
};

/** Admin Reverse Payout Input */
export type ReversePayoutInput = {
  reason: string;
};
