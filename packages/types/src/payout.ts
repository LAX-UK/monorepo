/** Payout Status */
export const payoutStatuses = [
  "scheduled",
  "in_transit",
  "paid",
  "failed",
  "reversed",
  "clawback_pending",
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
};

/** Payout Line - individual line item in a payout */
export type PayoutLine = {
  id: string;
  payoutId: string;
  paymentId: string | null;
  amount: string;
  kind: PayoutLineKind;
  createdByUserId: string | null;
  note: string | null;
  createdAt: Date;
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
