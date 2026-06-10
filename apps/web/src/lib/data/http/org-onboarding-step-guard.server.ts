import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import {
  orgOnboardingStepHref,
  resolveBlockedOnboardingStep,
  resolveTypeStepForwardRedirect,
} from "@/lib/legal-entity/org-onboarding-resume";
import { ORG_ONBOARDING_STEPS, type OrgOnboardingStepKey } from "@auction/types";
import type { CreateOrganizationInput, PublicOrganisationSubkind } from "@auction/validators";
import { redirect } from "next/navigation";

type Address = NonNullable<CreateOrganizationInput["primaryAddress"]>;

export type OrgOnboardingDocumentDto = {
  id: string;
  kind: string;
  label: string | null;
  reviewStatus: string;
};

export type OrgOnboardingState = {
  completedSteps: OrgOnboardingStepKey[];
  subkind: PublicOrganisationSubkind | null;
  displayName: string;
  legalName: string;
  vatNumber: string;
  primaryAddress: Address | null;
  documents: OrgOnboardingDocumentDto[];
};

function redirectOnOnboardingFetchFailure(entityId: string): never {
  redirect(orgOnboardingStepHref("type", { entityId }));
}

/** Single fetch of organisation onboarding state for wizard pages and guards. */
export async function fetchOrgOnboardingState(
  entityId: string,
): Promise<OrgOnboardingState | null> {
  const res = await authedServerFetch(`/organizations/${entityId}/onboarding`, {
    cache: "no-store",
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    data?: {
      completedSteps?: OrgOnboardingStepKey[];
      documents?: OrgOnboardingDocumentDto[];
      primaryAddress?: Address | null;
      entity?: {
        subkind?: PublicOrganisationSubkind | null;
        displayName?: string;
        legalName?: string | null;
        vatNumber?: string | null;
      };
    };
  };

  const completedSteps = (body.data?.completedSteps ?? []).filter((step) =>
    (ORG_ONBOARDING_STEPS as readonly string[]).includes(step),
  );

  return {
    completedSteps,
    subkind: body.data?.entity?.subkind ?? null,
    displayName: body.data?.entity?.displayName ?? "",
    legalName: body.data?.entity?.legalName ?? "",
    vatNumber: body.data?.entity?.vatNumber ?? "",
    primaryAddress: body.data?.primaryAddress ?? null,
    documents: body.data?.documents ?? [],
  };
}

/** Redirect to the earliest incomplete onboarding step when jumping ahead via URL. */
export async function redirectIfOrgOnboardingStepBlocked(
  entityId: string,
  requestedStep: OrgOnboardingStepKey,
): Promise<OrgOnboardingState> {
  const state = await fetchOrgOnboardingState(entityId);
  if (!state) redirectOnOnboardingFetchFailure(entityId);

  const blockedStep = resolveBlockedOnboardingStep(requestedStep, state.completedSteps);
  if (blockedStep) {
    redirect(orgOnboardingStepHref(blockedStep, { entityId }));
  }

  return state;
}

/** When resuming on the type step but type is already complete, skip forward. */
export async function redirectIfOrgOnboardingTypeStepComplete(
  entityId: string,
): Promise<OrgOnboardingState | null> {
  const state = await fetchOrgOnboardingState(entityId);
  if (!state) redirectOnOnboardingFetchFailure(entityId);

  const forwardStep = resolveTypeStepForwardRedirect(state.completedSteps);
  if (forwardStep) {
    redirect(orgOnboardingStepHref(forwardStep, { entityId }));
  }

  return state;
}
