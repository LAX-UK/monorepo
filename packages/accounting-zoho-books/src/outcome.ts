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
