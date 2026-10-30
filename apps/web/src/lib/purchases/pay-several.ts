import type { PaySeveralSkipReason } from "@auction/domain";

/** Why a picked invoice is left out of one payment, as the payer reads it. */
export const PAY_SEVERAL_SKIP_COPY: Record<PaySeveralSkipReason, string> = {
  other_account: "Won for another account",
  not_owed: "Already paid, or the payment is being confirmed",
  not_payer: "Your role doesn't pay this invoice",
  not_invoiced: "No invoice yet",
};

/** Why one payment of the picks cannot be taken, as the payer reads it. */
export type PaySeveralBlock =
  | "payer_on_hold"
  | "below_minimum"
  | "over_limit"
  | "needs_finance_review"
  | "nothing_payable"
  | "mixed_currency";

export const PAY_SEVERAL_BLOCK_COPY: Record<PaySeveralBlock, string> = {
  payer_on_hold: "We're checking a few details before you can pay. We'll email you when it's done.",
  below_minimum: "The total is below what one online payment can take. Add another invoice.",
  over_limit: "The total is more than one online payment can take. Pick fewer invoices.",
  needs_finance_review:
    "A total this size is checked by our finance team first. Pick fewer invoices to pay now.",
  nothing_payable: "None of these invoices can be paid now.",
  mixed_currency: "These invoices are in different currencies. Pay each currency on its own.",
};

/** The plan for one payment, as the dialog shows it. */
export type PaySeveralPlanView = {
  payable: { lotId: string; totalDue: string }[];
  skipped: { lotId: string; reason: PaySeveralSkipReason }[];
  total: string;
  currency: string;
  /** Why the payment cannot go ahead as picked; `null` while it can. */
  block: PaySeveralBlock | null;
};

/** Where the payer goes to pay: the combined checkout, or the checkout for several lots. */
export type PaySeveralStart = { ok: true; url: string } | { ok: false; message: string };

/** The checkout for several lots, used while one combined payment is not available. */
export function multiLotCheckoutHref(lotIds: readonly string[]): string {
  return `/purchases/checkout?lots=${lotIds.map(encodeURIComponent).join(",")}`;
}
