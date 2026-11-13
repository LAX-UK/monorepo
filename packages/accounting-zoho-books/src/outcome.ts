import type { IssueOutcome, LookupOutcome } from "@auction/accounting-domain";
import type { ZohoBooksError } from "./errors.js";

/**
 * What the domain is told when a create/update call fails. `rejected` means Zoho did not act, so the
 * life cycle may treat the document as not created; `unknown` means it may exist, so the life cycle
 * must look it up by its LAX reference before it tries again. The reason is a fixed code.
 */
export function toIssueFailure(
  error: ZohoBooksError,
): Extract<IssueOutcome, { status: "rejected" | "unknown" }> {
  return error.certainty === "rejected"
    ? { status: "rejected", reason: error.reason }
    : { status: "unknown", detail: error.reason };
}

/** What the domain is told when a lookup call fails: absence is only ever a 404; anything else is unavailable. */
export function toLookupFailure(
  error: ZohoBooksError,
): Extract<LookupOutcome, { status: "not_found" | "unavailable" }> {
  return error.kind === "not_found"
    ? { status: "not_found" }
    : { status: "unavailable", reason: error.reason };
}

/**
 * Refusals that mean "not now" rather than "not this": Books did not act (rate limit, the day's
 * call budget is spent, or the send's lease ran too short to start a write), so the same request may succeed later. Every other refusal is about the
 * document itself and waits for a person. A refusal reason starts with one of these.
 */
export const TRANSIENT_REJECTION_PREFIXES: readonly string[] = [
  "zoho_books_rate_limited_",
  "zoho_books_budget_exhausted_",
  "zoho_books_fenced_",
];

export function isTransientRejection(reason: string): boolean {
  return TRANSIENT_REJECTION_PREFIXES.some((prefix) => reason.startsWith(prefix));
}
