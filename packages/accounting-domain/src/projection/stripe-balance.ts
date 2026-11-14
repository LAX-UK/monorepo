import {
  type AccountingDocument,
  type Product,
  buildExpense,
  buildTransfer,
  stripeSourceId,
} from "../document.js";
import { isPence } from "../money.js";
import { type Result, ok, refuse } from "../result.js";
import type { Projection, ProjectionCode } from "./projection.js";

/**
 * One Stripe balance transaction as Stripe reported it, in the account's smallest unit (pence for
 * GBP). Amounts are signed as Stripe signs them: money into the balance is positive, out negative;
 * `feePence` is what Stripe took (negative when Stripe gave a fee back).
 */
export interface StripeBalanceTransactionFacts {
  /** `txn_...`, case as Stripe writes it. */
  readonly id: string;
  readonly type: string;
  /** Lower case, as Stripe writes it ("gbp"). */
  readonly currency: string;
  readonly amountPence: number;
  readonly feePence: number;
  /** The London calendar day Stripe created it, `YYYY-MM-DD`. */
  readonly createdOn: string;
  /** For the payout types: the payout (`po_...`) it moved. Null otherwise. */
  readonly payoutId: string | null;
}

/**
 * Which LAX product a balance transaction belongs to, decided by the runtime from stored LAX rows
 * only: the Stripe account's own row (the account is one company's) for a payout or one of
 * Stripe's own fees, and the stored payment, payment group or order for anything that came from a
 * charge. Never guessed: no stored row, or rows that disagree, and a person decides.
 */
export type StripeAttribution =
  | { readonly status: "attributed"; readonly product: Product }
  /** No stored LAX row names it (a charge LAX never took, say). */
  | { readonly status: "unattributable" }
  /** Stored rows name two companies (a charge of one company in the other's Stripe account). */
  | { readonly status: "conflict" };

/** Why a balance transaction waits for a person instead of being booked. */
export const STRIPE_PARK_REASONS = [
  /** No stored LAX row says which company it belongs to. */
  "unattributable",
  /** Stored rows say two different companies. */
  "attribution_conflict",
  /** Not in pounds: the books are kept in GBP only. */
  "not_in_pounds",
  /** Stripe gave a fee back (a negative fee, or a credit of one of its own fees). */
  "fee_refund",
  /** A payout failed or was cancelled, so its money came back to the Stripe balance. */
  "payout_reversed",
  /** Stripe reported amounts that cannot be (not whole pence, a payout into the balance). */
  "bad_amounts",
] as const;
export type StripeParkReason = (typeof STRIPE_PARK_REASONS)[number];

/** What the daily Stripe job does with one balance transaction. */
export type StripeBalanceDecision =
  | {
      readonly action: "book";
      readonly product: Product;
      readonly projection: Projection;
      /** The fee booked as an expense (0 when none). */
      readonly feePence: number;
      /** The payout booked as a transfer (0 when none). */
      readonly payoutPence: number;
    }
  | { readonly action: "park"; readonly reason: StripeParkReason }
  /** Nothing for this job to book: the money itself is booked by its own flow (a payment, say). */
  | { readonly action: "nothing" };

/** Stripe's own charges, where the amount is the fee (`fee` is 0). */
const FEE_TYPES = new Set(["stripe_fee", "stripe_fx_fee", "tax_fee"]);
const PAYOUT_REVERSALS = new Set(["payout_cancel", "payout_failure"]);

/** The fee and payout to book, before the company is known, or why it must wait for a person. */
function amountsToBook(
  t: StripeBalanceTransactionFacts,
): { feePence: number; payoutPence: number } | { park: StripeParkReason } {
  if (!Number.isSafeInteger(t.amountPence) || !Number.isSafeInteger(t.feePence)) {
    return { park: "bad_amounts" };
  }
  if (PAYOUT_REVERSALS.has(t.type)) return { park: "payout_reversed" };
  if (t.feePence < 0) return { park: "fee_refund" };
  let feePence = t.feePence;
  let payoutPence = 0;
  if (FEE_TYPES.has(t.type)) {
    if (t.amountPence > 0) return { park: "fee_refund" };
    feePence += -t.amountPence;
  }
  if (t.type === "payout") {
    if (t.amountPence >= 0 || t.payoutId === null) return { park: "bad_amounts" };
    payoutPence = -t.amountPence;
  }
  return { feePence, payoutPence };
}

/**
 * The Stripe fees and payouts policy (plan flow 25). Pure: facts and the stored attribution in,
 * documents out. A fee becomes an expense `LAX-<P>-EXP-<balance transaction>` paid from the Stripe
 * clearing account; a payout becomes a transfer `LAX-<P>-TRF-<payout>` from clearing to the bank
 * (an instant payout's fee is its own expense). The references are the duplicate guard: the same
 * balance transaction always gives the same documents. The charge, refund or dispute amount itself
 * is never booked here; it belongs to its own flow. A fee given back, a reversed payout, money not
 * in pounds, or a transaction no stored row attributes, waits for a person.
 */
export function decideStripeBalanceTransaction(
  t: StripeBalanceTransactionFacts,
  attribution: StripeAttribution,
): Result<StripeBalanceDecision, ProjectionCode> {
  const amounts = amountsToBook(t);
  if ("park" in amounts) return ok({ action: "park", reason: amounts.park });
  if (amounts.feePence === 0 && amounts.payoutPence === 0) return ok({ action: "nothing" });
  if (t.currency !== "gbp") return ok({ action: "park", reason: "not_in_pounds" });
  if (attribution.status === "unattributable") {
    return ok({ action: "park", reason: "unattributable" });
  }
  if (attribution.status === "conflict") {
    return ok({ action: "park", reason: "attribution_conflict" });
  }
  const { product } = attribution;
  const documents: AccountingDocument[] = [];
  if (amounts.feePence > 0) {
    const sourceId = stripeSourceId(t.id);
    if (!sourceId.ok) return refuse("bad_facts", "balance transaction id is not a Stripe id");
    if (!isPence(amounts.feePence)) return refuse("bad_amount", "fee is not whole pence");
    const expense = buildExpense({
      product,
      sourceId: sourceId.value,
      category: "stripe_fees",
      spentOn: t.createdOn,
      amountPence: amounts.feePence,
      description: `Stripe fees ${t.id} (${t.type})`.slice(0, 100),
    });
    if (!expense.ok) return expense;
    documents.push(expense.value);
  }
  if (amounts.payoutPence > 0 && t.payoutId !== null) {
    const sourceId = stripeSourceId(t.payoutId);
    if (!sourceId.ok) return refuse("bad_facts", "payout id is not a Stripe id");
    const transfer = buildTransfer({
      product,
      sourceId: sourceId.value,
      transferredOn: t.createdOn,
      amountPence: amounts.payoutPence,
      description: `Stripe payout ${t.payoutId}`,
    });
    if (!transfer.ok) return transfer;
    documents.push(transfer.value);
  }
  return ok({
    action: "book",
    product,
    projection: { documents },
    feePence: amounts.feePence,
    payoutPence: amounts.payoutPence,
  });
}
