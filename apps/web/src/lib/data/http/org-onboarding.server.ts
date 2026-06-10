import "server-only";

import type { OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { fetchOrgOnboardingState } from "@/lib/data/http/org-onboarding-step-guard.server";
import {
  earliestIncompleteOrgOnboardingStep,
  orgOnboardingResumeHref,
} from "@/lib/legal-entity/org-onboarding-resume";
import { cache } from "react";

export type { OrgOnboardingResumeVm };

/** Resume href for a single organisation draft from API completed steps. */
export async function getOrgOnboardingResumeHrefForEntity(
  entityId: string,
): Promise<string | null> {
  const state = await fetchOrgOnboardingState(entityId);
  if (!state) return null;
  const missing = earliestIncompleteOrgOnboardingStep(state.completedSteps);
  if (!missing) return null;
  return orgOnboardingResumeHref(entityId, state.completedSteps);
}

/** First organisation membership (lead) with incomplete onboarding steps, if any. */
export const getServerOrgOnboardingResume = cache(
  async function getServerOrgOnboardingResume(): Promise<OrgOnboardingResumeVm | null> {
    const res = await authedServerFetch("/legal-entities/me", { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: Array<{ id: string; displayName: string; kind: string; status: string }>;
    };
    const memberships = body.data ?? [];
    const leads = memberships.filter((m) => m.kind === "organisation" && m.status === "lead");
    for (const org of leads) {
      const resumeHref = await getOrgOnboardingResumeHrefForEntity(org.id);
      if (resumeHref) {
        return {
          entityId: org.id,
          displayName: org.displayName,
          resumeHref,
        };
      }
    }
    return null;
  },
);
