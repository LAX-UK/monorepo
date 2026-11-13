import { minorUnitsToMoneyString } from "./money-compare.js";
import type { SellerTermsHeldReason, SellerTermsSnapshot } from "./seller-terms.js";
import type { PayoutLineFacts } from "./selling-records.js";

/** A snapshot that pays its seller: the agreement's figures, all present and adding up. */
export type PayableSellerTerms = Extract<SellerTermsSnapshot, { basis: "agreement" }>;

/**
 * Where one captured sale stands for a payout run:
 * - `ready`: paid on its snapshot; the line's amount is the hammer and the seller gets the net;
 * - `held`: a fact the rule needs is missing; the sale waits, and the rest of the run is paid;
 * - `lax_owned`: LAX's own stock; nothing is paid out.
 */
export type SettlementSale =
  | { kind: "ready"; paymentId: string; sellerTermsId: string; terms: PayableSellerTerms }
  | { kind: "held"; paymentId: string; lotId: string | null; reason: SellerTermsHeldReason }
  | { kind: "lax_owned"; paymentId: string };

/** A sale a payout run left out, with the reason staff fix. */
export type HeldSettlementSale = {
  paymentId: string;
  lotId: string | null;
  reason: SellerTermsHeldReason;
};

/** What a sale line on a payout is, worked out from the snapshot it pays. */
export type SnapshotSaleLine = {
  /** The line's amount: the hammer, in pounds. */
  amount: string;
  /** The facts the payout's totals and every screen split the line with. */
  facts: PayoutLineFacts;
};

const money = (pence: number) => minorUnitsToMoneyString(BigInt(pence));

/** The sum a seller is charged out of a sale: the commission and the VAT on it. */
export function sellerDeductionsPence(terms: PayableSellerTerms): number {
  return terms.commissionPence + terms.commissionVatPence;
}

/**
 * The sale line that pays a snapshot. Its amount is the hammer and its split is the commission plus
 * VAT, so the payout's gross is the hammer total, its platform fee is commission plus VAT and its
 * net is what the seller receives: `payoutTotals` adds them up with no second sum.
 */
export function snapshotSaleLine(terms: PayableSellerTerms): SnapshotSaleLine {
  const amount = money(terms.hammerPence);
  return {
    amount,
    facts: {
      kind: "sale",
      amount,
      payment: { amount, platformFee: money(sellerDeductionsPence(terms)) },
    },
  };
}

/** A payout's lot sales split the way each snapshot splits its sale, in pounds. */
export type SellerTermsTotals = { hammer: string; commission: string; commissionVat: string };

/** The hammer, commission and VAT totals of the sales a payout pays, from their snapshots. */
export function sellerTermsTotals(sales: readonly PayableSellerTerms[]): SellerTermsTotals {
  let hammer = 0;
  let commission = 0;
  let commissionVat = 0;
  for (const terms of sales) {
    hammer += terms.hammerPence;
    commission += terms.commissionPence;
    commissionVat += terms.commissionVatPence;
  }
  return {
    hammer: money(hammer),
    commission: money(commission),
    commissionVat: money(commissionVat),
  };
}

/** The facts a refund is charged back to the seller from. All amounts are whole pence. */
export type SellerClawbackInput = {
  /** What the seller received for the sale, from its snapshot. */
  sellerNetPence: number;
  /** What the buyer paid for the sale. */
  paymentPence: number;
  /** Everything refunded to the buyer for the sale so far, including the refund being handled. */
  buyerRefundedPence: number;
};

function assertPence(value: number, what: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${what} must be whole, non-negative pence`);
  }
}

/**
 * How much of what the seller received is taken back once the buyer has been refunded this much:
 * the seller's net in the same share as the buyer's refund of their payment, rounded half-up to
 * the penny, and exactly the net once the buyer is refunded in full. The seller never gives back
 * the buyer's premium or the commission and VAT they did not receive. Cumulative: the amount to
 * charge now is this less what has already been charged back.
 */
export function sellerClawbackPence(input: SellerClawbackInput): number {
  const { sellerNetPence, paymentPence, buyerRefundedPence } = input;
  assertPence(sellerNetPence, "seller net");
  assertPence(paymentPence, "payment");
  assertPence(buyerRefundedPence, "buyer refund");
  if (buyerRefundedPence === 0) return 0;
  if (paymentPence === 0 || buyerRefundedPence >= paymentPence) return sellerNetPence;
  // half-up(net × refunded ÷ payment), in integers: the product can pass 2^53 at £1bn.
  const net = BigInt(sellerNetPence);
  const refunded = BigInt(buyerRefundedPence);
  const paid = BigInt(paymentPence);
  return Number((net * refunded * 2n + paid) / (paid * 2n));
}

/** What a buyer's refund is charged back to the seller from, for one sale. Whole pence. */
export type SellerClawbackFacts = {
  /** What the buyer paid. */
  paymentPence: number;
  /**
   * How the sale was paid out: from its snapshot (the seller's net), under the old rule (a sale
   * line with no snapshot), or not at all yet.
   */
  paidOut:
    | { kind: "snapshot"; sellerNetPence: number }
    | { kind: "old_rule" }
    | { kind: "not_paid_out" };
  /** What has been charged back to the seller for it so far (a positive figure). */
  clawedBackPence: number;
  /** The buyer refunds those charges answered for. */
  buyerRefundAnsweredPence: number;
};

/** A refund line on the seller's ledger: what is charged now and the buyer refund it answers for. */
export type SellerRefundCharge = { chargePence: number; buyerRefundPence: number };

/**
 * What a buyer's refund charges the seller, or `null` when it charges nothing.
 *
 * - Not paid out: nothing. The seller received nothing for the sale, and a sale refunded in full
 *   drops out of the payout run; a part refund is charged when the run pays the sale.
 * - Paid from a snapshot: the seller's share of everything refunded so far (see
 *   `sellerClawbackPence`), less what has already been charged back.
 * - Paid under the old rule: the refund as it stands, as old payouts were charged. Finance reviews
 *   payouts paid under the old rule one by one; nothing here changes them.
 */
export function sellerRefundCharge(input: {
  facts: SellerClawbackFacts;
  /** The buyer refund being handled now. */
  buyerRefundPence: number;
}): SellerRefundCharge | null {
  const { facts, buyerRefundPence } = input;
  const buyerRefundedBeforePence = facts.buyerRefundAnsweredPence;
  assertPence(buyerRefundedBeforePence, "earlier buyer refunds");
  assertPence(buyerRefundPence, "buyer refund");
  if (buyerRefundPence === 0) return null;
  switch (facts.paidOut.kind) {
    case "not_paid_out":
      return null;
    case "old_rule":
      return { chargePence: buyerRefundPence, buyerRefundPence };
    case "snapshot": {
      const due = sellerClawbackPence({
        sellerNetPence: facts.paidOut.sellerNetPence,
        paymentPence: facts.paymentPence,
        buyerRefundedPence: Math.min(
          facts.paymentPence,
          buyerRefundedBeforePence + buyerRefundPence,
        ),
      });
      const chargePence = due - facts.clawedBackPence;
      return chargePence > 0 ? { chargePence, buyerRefundPence } : null;
    }
  }
}
