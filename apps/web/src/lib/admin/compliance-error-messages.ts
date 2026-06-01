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
    default:
      return code;
  }
}
