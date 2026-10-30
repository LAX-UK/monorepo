import { minorUnitsToMoneyString, parseMoneyToMinorUnits } from "./money-compare.js";

/** The reference a seller quotes to a specialist, from the consignment's reference number. */
export function consignmentReference(referenceNumber: number): string {
  return `C-${referenceNumber}`;
}

/**
 * Where the money for a sold lot stands, from the seller's side:
 * - `buyer_paying`: sold, and the buyer has not paid yet;
 * - `paid_by_buyer`: the buyer paid; it joins the next payout;
 * - `in_payout`: on a payout that is scheduled or on its way;
 * - `paid_out`: the payout reached the bank;
 * - `payout_problem`: the payout failed or was reversed, and the team is on it;
 * - `refunded`: the sale was refunded to the buyer.
 */
export type SoldLotPayoutStage =
  | "buyer_paying"
  | "paid_by_buyer"
  | "in_payout"
  | "paid_out"
  | "payout_problem"
  | "refunded";

export type SoldLotFacts = {
  /** The buyer's payment for the lot, or `null` before one exists. */
  paymentStatus:
    | "pending"
    | "authorized"
    | "captured"
    | "refunded"
    | "requires_manual_review"
    | "cancelled"
    | null;
  /** The payout the sale is on, or `null` while it is on none. */
  payoutStatus:
    | "scheduled"
    | "in_transit"
    | "paid"
    | "failed"
    | "reversed"
    | "clawback_pending"
    | null;
};

const BY_PAYOUT: Record<NonNullable<SoldLotFacts["payoutStatus"]>, SoldLotPayoutStage> = {
  scheduled: "in_payout",
  in_transit: "in_payout",
  paid: "paid_out",
  failed: "payout_problem",
  reversed: "payout_problem",
  clawback_pending: "payout_problem",
};

/** The one payout stage for a sold lot; a payout, once the sale is on one, decides it. */
export function soldLotPayoutStage(facts: SoldLotFacts): SoldLotPayoutStage {
  if (facts.paymentStatus === "refunded") return "refunded";
  if (facts.payoutStatus) return BY_PAYOUT[facts.payoutStatus];
  return facts.paymentStatus === "captured" ? "paid_by_buyer" : "buyer_paying";
}

/** A sale line on a payout, as stored: the amount settled and the payment it came from. */
export type SaleLineFacts = {
  /** The amount settled for the sale on this payout. */
  lineAmount: string;
  /** The buyer's payment the line settles, and LAX's share of it. */
  paymentAmount: string;
  platformFee: string;
};

export type SaleLineBreakdown = {
  /** What the sale settled for on this payout. */
  gross: string;
  /** LAX's commission and fees on it, in proportion when only part of the payment settled. */
  commissionAndFees: string;
  /** What reaches the seller for it. */
  net: string;
};

/**
 * Splits a sale line into gross, LAX's commission and fees, and net, the way settlement does: the
 * fee follows the share of the payment the line settles, rounded to the penny.
 */
export function saleLineBreakdown(facts: SaleLineFacts): SaleLineBreakdown {
  const gross = parseMoneyToMinorUnits(facts.lineAmount);
  const payment = parseMoneyToMinorUnits(facts.paymentAmount);
  const fee = parseMoneyToMinorUnits(facts.platformFee);
  const share = payment > 0n ? (fee * gross * 2n + payment) / (payment * 2n) : fee;
  return {
    gross: minorUnitsToMoneyString(gross),
    commissionAndFees: minorUnitsToMoneyString(share),
    net: minorUnitsToMoneyString(gross - share),
  };
}
