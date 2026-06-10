import type { LegalEntityStatus, OrgOnboardingStepKey } from "@auction/types";

/**
 * Fallback resume step from KYB status when onboarding API progress is unavailable.
 * Prefer {@link getOrgOnboardingResumeHrefForEntity} when entity id is known.
 */
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
