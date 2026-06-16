/** Human-readable copy for compliance API error codes surfaced in admin redirects. */
export function complianceErrorMessage(code: string): string {
  switch (code) {
    case "aml_triage_self_forbidden":
    case "source_of_funds_triage_self_forbidden":
      return "You cannot triage your own case or screening.";
    case "aml_review_self_forbidden":
    case "source_of_funds_review_self_forbidden":
      return "You cannot decide your own case or screening.";
    case "aml_review_same_as_triager":
    case "source_of_funds_review_same_as_triager":
      return "A different MLRO must make the binding decision (four-eyes).";
    case "aml_triage_required":
    case "source_of_funds_triage_required":
      return "Record analyst triage before the MLRO decision.";
    case "aml_screening_not_pending":
    case "source_of_funds_not_pending":
      return "This case is no longer pending review.";
    case "aml_triage_already_set":
    case "source_of_funds_triage_already_set":
      return "Triage was already recorded for this case.";
    case "aml_screening_not_found":
    case "source_of_funds_not_found":
      return "Case or screening not found.";
    case "source_of_funds_not_rejected":
      return "Only rejected Source of Funds cases can be reopened.";
    case "source_of_funds_document_not_found":
      return "Document not found on this case.";
    case "source_of_funds_document_superseded":
      return "This document was superseded by a newer upload.";
    case "source_of_funds_documents_already_requested":
      return "Documents were already requested for this case.";
    default:
      return code;
  }
}

const SOF_STALE_CONFLICT_CODES = new Set([
  "source_of_funds_not_pending",
  "source_of_funds_triage_already_set",
  "source_of_funds_document_not_found",
  "source_of_funds_document_superseded",
  "source_of_funds_documents_already_requested",
]);

export function isSofStaleConflictMessage(message: string): boolean {
  if (SOF_STALE_CONFLICT_CODES.has(message)) return true;
  if (message.includes("no longer pending")) return true;
  if (message.includes("superseded by a newer upload")) return true;
  if (message.includes("Documents were already requested")) return true;
  return false;
}

export const SOF_STALE_RELOAD_MESSAGE =
  "This case changed since you opened it. Reload to see the latest state before continuing.";
