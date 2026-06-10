import { resumeOnboardingStepKey } from "@/components/organisations/org-onboarding-step-map";
import type { LegalEntityStatus } from "@auction/types";

/** Organisation KYB statuses where onboarding may still be resumed. */
export function isOrgOnboardingInProgress(status: LegalEntityStatus): boolean {
  return resumeOnboardingStepKey(status) !== null;
}
