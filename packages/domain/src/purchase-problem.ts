/** What a buyer's problem with a paid purchase is about. */
export const PURCHASE_PROBLEM_CATEGORIES = [
  "not_as_described",
  "damaged",
  "not_received",
  "invoice_or_payment",
  "other",
] as const;
export type PurchaseProblemCategory = (typeof PURCHASE_PROBLEM_CATEGORIES)[number];

/** A reported problem is open until someone takes it on, in progress while they work it, then resolved. */
export const PURCHASE_PROBLEM_STATUSES = ["open", "in_progress", "resolved"] as const;
export type PurchaseProblemStatus = (typeof PURCHASE_PROBLEM_STATUSES)[number];

/** The statuses that still need someone. A buyer has at most one report in these per purchase. */
export const PURCHASE_PROBLEM_UNRESOLVED_STATUSES = ["open", "in_progress"] as const;

/** The longest note staff may add when working or resolving a report. */
export const PURCHASE_PROBLEM_NOTE_MAX = 2000;

/** The status each status may move to by hand. A resolved report stays resolved. */
const NEXT_STATUSES: Record<PurchaseProblemStatus, readonly PurchaseProblemStatus[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: [],
};

export function purchaseProblemNextStatuses(
  status: PurchaseProblemStatus,
): readonly PurchaseProblemStatus[] {
  return NEXT_STATUSES[status];
}

export type PurchaseProblemTransitionRefusal = "not_allowed" | "resolution_note_required";

/**
 * Why a status change may not be made, or null. Resolving closes the report for the buyer, so it
 * always carries a note saying what was done.
 */
export function purchaseProblemTransitionRefusal(input: {
  from: PurchaseProblemStatus;
  to: PurchaseProblemStatus;
  note: string | undefined;
}): PurchaseProblemTransitionRefusal | null {
  if (!NEXT_STATUSES[input.from].includes(input.to)) return "not_allowed";
  if (input.to === "resolved" && !input.note?.trim()) return "resolution_note_required";
  return null;
}

/** The short reference the buyer and the team quote, taken from the case id. */
export function purchaseProblemReference(caseId: string): string {
  return `PR-${caseId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}
