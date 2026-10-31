import type { PaySeveralSkipReason } from "@auction/domain";

/** Why a picked invoice is left out of one payment, as the payer reads it. */
export const PAY_SEVERAL_SKIP_COPY: Record<PaySeveralSkipReason, string> = {
  other_account: "Won for another account",
  not_owed: "Already paid, or the payment is being confirmed",
  not_payer: "Your role doesn't pay this invoice",
  not_invoiced: "No invoice yet",
  held_for_review: "Held while we review a payment",
  being_paid: "A payment for it is already in progress",
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

/** Where the payer goes to pay the one combined payment, or why it could not be opened. */
export type PaySeveralStart = { ok: true; url: string } | { ok: false; message: string };

/** What a refused payment says, by the API's code; anything else reads as a passing failure. */
export const PAY_SEVERAL_START_COPY: Readonly<Record<string, string>> = {
  pay_several_payer_on_hold: PAY_SEVERAL_BLOCK_COPY.payer_on_hold,
  pay_several_below_minimum: PAY_SEVERAL_BLOCK_COPY.below_minimum,
  pay_several_over_limit: PAY_SEVERAL_BLOCK_COPY.over_limit,
  pay_several_needs_finance_review: PAY_SEVERAL_BLOCK_COPY.needs_finance_review,
  pay_several_nothing_payable: PAY_SEVERAL_BLOCK_COPY.nothing_payable,
  pay_several_mixed_currency: PAY_SEVERAL_BLOCK_COPY.mixed_currency,
  pay_several_conflict:
    "One of these invoices changed while you were looking. Close this and try again.",
  pay_several_unavailable: "Paying several invoices at once is paused. Pay each one on its own.",
};

export const PAY_SEVERAL_START_FAILED =
  "We couldn't open the payment. Nothing was charged. Try again in a moment.";
