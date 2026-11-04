import type { ManualReviewReason, PaymentStatus } from "@auction/types";
import type { PurchasePaymentRole } from "./buyer-payment-authority.js";
import { type MoneyTotal, sumMoneyByCurrency } from "./money-totals.js";
import { purchaseEnding, purchaseIsToPay } from "./purchase-state.js";

/**
 * The one reading of what an account owes. Where a purchase stands is decided here, from the
 * payment, the saleroom's fulfilment record and the buyer's open checks, so the header chip,
 * Purchases, the Needs-you counts and the LAX Account portfolio can only ever agree.
 */

/**
 * The most won lots one read of an account's purchases follows. Purchases lists exactly these and
 * the amounts owed add up exactly these, so the list and its totals cannot disagree; a screen that
 * reaches the limit says it is showing the latest ones.
 */
export const PURCHASE_LIST_LIMIT = 500;

/** The buyer's account-wide checks: they hold every unpaid purchase until cleared. */
export type AccountHold = "clear" | "aml_hold" | "source_of_funds_required";

/** What stops a purchase being paid: documents the buyer can provide, or checks we are doing. */
export type AmountOwedBlocker = "documents" | "review";

/**
 * - `payment-due`: owed and can be paid now;
 * - `in-review`: owed, held until checks are done;
 * - `cancelled`: the sale was cancelled at fulfilment; nothing is owed.
 */
export type AmountOwedState = "payment-due" | "in-review" | "cancelled";

export type AmountOwedFacts = {
  lotId: string;
  /** The latest payment for the lot and account, or `null` before checkout started. */
  paymentStatus: PaymentStatus | null;
  /** The saleroom's fulfilment status for the lot, when a record exists. */
  fulfilmentStatus: string | null;
  /** Why the lot's own payment is held, when it is. */
  paymentReviewReason: ManualReviewReason | null;
  role: PurchasePaymentRole;
  /** What one payment would cover: the total with the buyer's premium, in major units. */
  amountDue: string | null;
  currency: string;
};

export type AmountOwedEntry = {
  lotId: string;
  state: AmountOwedState;
  role: PurchasePaymentRole;
  amountDue: string | null;
  currency: string;
  /** Set only for the person who pays, and only while the purchase is held. */
  blocker: AmountOwedBlocker | null;
};

/** The reason the lot's own payment is held, when it is one of the checks or a finance hold. */
function holdingReason(facts: AmountOwedFacts, account: AccountHold): ManualReviewReason | null {
  if (facts.paymentReviewReason) return facts.paymentReviewReason;
  return account === "clear" ? null : account;
}

/**
 * The entry for one won lot, or `null` when nothing is owed on it: it is being paid, paid or
 * refunded. A sale cancelled at fulfilment ends the purchase whatever the payment says.
 */
export function amountOwedEntry(
  facts: AmountOwedFacts,
  account: AccountHold,
): AmountOwedEntry | null {
  const { lotId, role, amountDue, currency } = facts;
  const paymentStatus = facts.paymentStatus;
  const ending = purchaseEnding({ paymentStatus, fulfilmentStatus: facts.fulfilmentStatus });
  if (ending === "refunded") return null;
  if (ending === "cancelled") {
    return { lotId, state: "cancelled", role, amountDue, currency, blocker: null };
  }
  if (!purchaseIsToPay({ paymentStatus })) return null;

  const reason = holdingReason(facts, account);
  const held = paymentStatus === "requires_manual_review" || reason !== null;
  const blocker: AmountOwedBlocker | null =
    held && role === "payer"
      ? reason === "source_of_funds_required"
        ? "documents"
        : "review"
      : null;
  return {
    lotId,
    state: held ? "in-review" : "payment-due",
    role,
    amountDue,
    currency,
    blocker,
  };
}

export type AmountsOwedSummary = {
  /** Lots the person has to pay for, whether or not they can be paid yet. */
  count: number;
  /** What they come to, per currency; currencies are never added together. */
  totals: MoneyTotal[];
  /** Lots that can be paid now. */
  payableCount: number;
  /** Something is owed and every part of it waits on checks. */
  inReview: boolean;
  /** The one thing to ask for: documents if any lot needs them, else just "checks open". */
  blocker: AmountOwedBlocker | null;
};

/** What the person pays themselves, summed. Lots someone else pays, and cancelled sales, are out. */
export function summariseAmountsOwed(entries: readonly AmountOwedEntry[]): AmountsOwedSummary {
  const mine = entries.filter((entry) => entry.role === "payer" && entry.state !== "cancelled");
  const payableCount = mine.filter((entry) => entry.state === "payment-due").length;
  const blockers = mine.flatMap((entry) => (entry.blocker ? [entry.blocker] : []));
  return {
    count: mine.length,
    totals: sumMoneyByCurrency(
      mine.flatMap((entry) =>
        entry.amountDue ? [{ currency: entry.currency, amount: entry.amountDue }] : [],
      ),
    ),
    payableCount,
    inReview: mine.length > 0 && payableCount === 0,
    blocker: blockers.includes("documents") ? "documents" : (blockers[0] ?? null),
  };
}
