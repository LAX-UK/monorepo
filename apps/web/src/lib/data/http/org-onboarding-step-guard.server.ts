import "server-only";

import { authedServerFetch } from "@/lib/data/http/authed-server-fetch";
import { ORG_ONBOARDING_STEPS, type OrgOnboardingStepKey } from "@auction/types";
import { redirect } from "next/navigation";

/** Redirect to the earliest incomplete onboarding step when jumping ahead via URL. */
export async function redirectIfOrgOnboardingStepBlocked(
  entityId: string,
  requestedStep: OrgOnboardingStepKey,
): Promise<void> {
  const res = await authedServerFetch(`/organizations/${entityId}/onboarding`, {
    cache: "no-store",
  });
  if (!res.ok) {
    redirect("/onboarding/organisation/step/type");
  }
  const body = (await res.json()) as { data?: { completedSteps?: OrgOnboardingStepKey[] } };
  const done = new Set(body.data?.completedSteps ?? []);
  const missing = ORG_ONBOARDING_STEPS.find((step) => !done.has(step));
  if (!missing) return;

  const requestedIndex = ORG_ONBOARDING_STEPS.indexOf(requestedStep);
  const missingIndex = ORG_ONBOARDING_STEPS.indexOf(missing);
  if (requestedIndex > missingIndex) {
    const qs = new URLSearchParams({ entityId });
    redirect(`/onboarding/organisation/step/${missing}?${qs.toString()}`);
  }
}
