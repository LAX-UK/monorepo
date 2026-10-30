import { addMoneyStrings } from "./money-compare.js";
import { type PurchaseInvoiceStatus, invoiceIsOwed } from "./purchase-invoice-state.js";

/** The most invoices one "Pay several" covers; larger batches are split by the person paying. */
export const PAY_SEVERAL_MAX_INVOICES = 20;

/** One purchase the payer picked, with what the rule needs to know about it. */
export type PaySeveralCandidate = {
  lotId: string;
  /** The invoice's open payment; `null` while no invoice is raised. */
  paymentId: string | null;
  /** The account the lot was won for; every pick must belong to the acting account. */
  buyerAccountId: string;
  invoice: PurchaseInvoiceStatus;
  /** Whether this payer may pay this lot (`buyerPaymentAuthority`). */
  payerMayPay: boolean;
  /**
   * The invoice total (hammer, premium and taxes) as a decimal string, in `currency`; `null`
   * while no invoice is raised, since only an invoice fixes the amount.
   */
  totalDue: string | null;
  currency: string;
  /**
   * The invoice waits for a finance or compliance review (for example the seller's account is
   * closed). Money is never taken for an invoice that cannot be released, so it is left out.
   */
  heldForReview: boolean;
  /** The invoice is already part of another payment that is still open. */
  inPaymentInProgress: boolean;
};

export type PaySeveralSkipReason =
  /** Won for another account: never paid from this one. */
  | "other_account"
  /** Already paid, being confirmed, refunded or cancelled. */
  | "not_owed"
  /** The payer does not move this account's money. */
  | "not_payer"
  /** No invoice is raised yet, so there is no amount to pay. */
  | "not_invoiced"
  /** Waiting for a finance or compliance review; paid on its own once released. */
  | "held_for_review"
  /** Already part of another payment that is still open. */
  | "being_paid";

export type PaySeveralRefusal =
  /** Nothing picked. */
  | "pay_several_empty"
  /** More than {@link PAY_SEVERAL_MAX_INVOICES} picked. */
  | "pay_several_too_many"
  /** The same lot picked twice. */
  | "pay_several_duplicate"
  /** None of the picks can be paid. */
  | "pay_several_nothing_payable"
  /** The payable picks are in more than one currency, so they cannot be one payment. */
  | "pay_several_mixed_currency";

/** A pick that will be paid, with its payment and amount known. */
export type PayableInvoice = PaySeveralCandidate & { paymentId: string; totalDue: string };

export type PaySeveralPlan = {
  /** The lots that will be paid together, in the order picked. */
  payable: PayableInvoice[];
  /** The lots left out, each with the reason, so the screen can say why. */
  skipped: { lotId: string; reason: PaySeveralSkipReason }[];
  currency: string;
  /** The sum of the payable lots' amounts due, as a decimal string. */
  total: string;
};

export type PaySeveralDecision =
  | { allowed: true; plan: PaySeveralPlan }
  | { allowed: false; reason: PaySeveralRefusal };

function skipReason(c: PaySeveralCandidate, accountId: string): PaySeveralSkipReason | null {
  if (c.buyerAccountId !== accountId) return "other_account";
  if (!invoiceIsOwed(c.invoice)) return "not_owed";
  if (!c.payerMayPay) return "not_payer";
  if (c.totalDue === null || c.paymentId === null) return "not_invoiced";
  if (c.heldForReview) return "held_for_review";
  if (c.inPaymentInProgress) return "being_paid";
  return null;
}

/**
 * Which of the picked invoices one payment can settle for the acting account. Picks that cannot
 * be paid are skipped with a reason rather than failing the whole batch, so a stale screen still
 * pays what it can; the batch is refused only when it is malformed or nothing is left, or when
 * what is left spans currencies.
 */
export function planPaySeveral(
  accountId: string,
  picks: readonly PaySeveralCandidate[],
): PaySeveralDecision {
  if (picks.length === 0) return { allowed: false, reason: "pay_several_empty" };
  if (picks.length > PAY_SEVERAL_MAX_INVOICES) {
    return { allowed: false, reason: "pay_several_too_many" };
  }
  if (new Set(picks.map((p) => p.lotId)).size !== picks.length) {
    return { allowed: false, reason: "pay_several_duplicate" };
  }
  const payable: PayableInvoice[] = [];
  const skipped: PaySeveralPlan["skipped"] = [];
  for (const pick of picks) {
    const reason = skipReason(pick, accountId);
    if (reason || pick.totalDue === null || pick.paymentId === null) {
      skipped.push({ lotId: pick.lotId, reason: reason ?? "not_invoiced" });
    } else payable.push({ ...pick, paymentId: pick.paymentId, totalDue: pick.totalDue });
  }
  const [first] = payable;
  if (!first) return { allowed: false, reason: "pay_several_nothing_payable" };
  if (payable.some((p) => p.currency !== first.currency)) {
    return { allowed: false, reason: "pay_several_mixed_currency" };
  }
  return {
    allowed: true,
    plan: {
      payable,
      skipped,
      currency: first.currency,
      total: payable.reduce((sum, p) => addMoneyStrings(sum, p.totalDue), "0.00"),
    },
  };
}
