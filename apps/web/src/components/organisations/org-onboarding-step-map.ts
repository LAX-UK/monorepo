import type { LegalEntityStatus, OrgOnboardingStepKey } from "@auction/types";

/** Maps KYB status to the onboarding step users should resume (when still in setup). */
export function resumeOnboardingStepKey(status: LegalEntityStatus): OrgOnboardingStepKey | null {
  if (
    status === "approved" ||
    status === "archived" ||
    status === "rejected" ||
    status === "restricted"
  ) {
    return null;
  }
  if (status === "lead") return "type";
  if (status === "docs_requested" || status === "docs_received") return "documents";
  if (status === "connect_pending") return "connect";
  if (status === "under_review") return "identity";
  return "details";
}
