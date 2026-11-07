import type { PayPlanLeftOutReason } from "@auction/types";
import { PAY_PLAN_MAX_LOTS } from "./pay-plan.js";

/** The most invoices one "Pay several" covers; larger batches are split by the person paying. */
export const PAY_SEVERAL_MAX_INVOICES = PAY_PLAN_MAX_LOTS;

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

/**
 * How a lot the pay plan leaves out is told to the combined-payment screen. The plan is the one
 * place that decides what is payable; this only renames its reasons.
 */
export function paySeveralSkipReason(reason: PayPlanLeftOutReason): PaySeveralSkipReason {
  switch (reason) {
    case "other_account":
      return "other_account";
    case "not_payer":
      return "not_payer";
    case "held_for_review":
      return "held_for_review";
    case "being_paid":
      return "being_paid";
    case "paid":
    case "being_confirmed":
    case "cancelled":
    case "refunded":
    case "voided":
      return "not_owed";
  }
}
