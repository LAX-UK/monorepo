/** What a buyer's problem with a paid purchase is about. */
export const PURCHASE_PROBLEM_CATEGORIES = [
  "not_as_described",
  "damaged",
  "not_received",
  "invoice_or_payment",
  "other",
] as const;
export type PurchaseProblemCategory = (typeof PURCHASE_PROBLEM_CATEGORIES)[number];

/** A reported problem is open until the client services team resolves it. */
export const PURCHASE_PROBLEM_STATUSES = ["open", "resolved"] as const;
export type PurchaseProblemStatus = (typeof PURCHASE_PROBLEM_STATUSES)[number];

/** The short reference the buyer and the team quote, taken from the case id. */
export function purchaseProblemReference(caseId: string): string {
  return `PR-${caseId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
