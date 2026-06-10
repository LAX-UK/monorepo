import "server-only";

import { fetchOrgOnboardingState } from "@/lib/data/http/org-onboarding-step-guard.server";
import { orgOnboardingStepKeyFromPathname } from "@/lib/legal-entity/org-onboarding-steps";
import type { OrgOnboardingStepKey } from "@auction/types";
import type { PublicOrganisationSubkind } from "@auction/validators";
import { headers } from "next/headers";

export type OrgOnboardingLayoutContext = {
  entityId: string | null;
  fresh: boolean;
  subkind: PublicOrganisationSubkind | null;
  displayName: string | null;
  completedSteps: OrgOnboardingStepKey[];
  currentStepKey: OrgOnboardingStepKey | null;
};

function parseSearchParams(search: string): URLSearchParams {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw);
}

/** Server-side wizard shell state from middleware path headers and onboarding API. */
export async function resolveOrgOnboardingLayoutContext(): Promise<OrgOnboardingLayoutContext> {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const params = parseSearchParams(h.get("x-search") ?? "");
  const fresh = params.get("fresh") === "1";
  const entityId = fresh ? null : params.get("entityId");
  const currentStepKey = orgOnboardingStepKeyFromPathname(pathname);

  if (!entityId) {
    return {
      entityId: null,
      fresh,
      subkind: null,
      displayName: null,
      completedSteps: [],
      currentStepKey,
    };
  }

  const state = await fetchOrgOnboardingState(entityId);
  return {
    entityId,
    fresh,
    subkind: state?.subkind ?? null,
    displayName: state?.displayName ?? null,
    completedSteps: state?.completedSteps ?? [],
    currentStepKey,
  };
}
