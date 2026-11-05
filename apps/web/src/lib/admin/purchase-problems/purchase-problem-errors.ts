/** What a refusal from the Bid API says to the person, one sentence each. */
export const PURCHASE_PROBLEM_ERROR_COPY: Readonly<Record<string, string>> = {
  purchase_problem_not_found: "This report no longer exists.",
  stale_version: "This report changed while you were editing it.",
  assignee_invalid: "That person can't be given purchase problems.",
  unchanged: "Nothing was changed.",
  not_allowed: "That change isn't available from this status.",
  resolution_note_required: "Say what was done before resolving this report.",
};

const UNAVAILABLE = "The Bid API didn't answer. Nothing was changed. Try again in a moment.";

/** The sentence for a failed write: the API's own refusal, or a plain "didn't answer". */
export function purchaseProblemErrorMessage(
  code: string | undefined,
  status: number | undefined,
): string {
  if (code && code in PURCHASE_PROBLEM_ERROR_COPY) {
    return PURCHASE_PROBLEM_ERROR_COPY[code] as string;
  }
  if (status === 403) return "You don't have permission to change purchase problems.";
  return UNAVAILABLE;
}

/** The report changed under the editor; the page offers a reload and keeps what was typed. */
export function isStalePurchaseProblem(code: string | undefined): boolean {
  return code === "stale_version";
}
