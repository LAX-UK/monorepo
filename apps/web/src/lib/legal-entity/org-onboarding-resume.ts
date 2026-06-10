import { ORG_ONBOARDING_STEPS, type OrgOnboardingStepKey } from "@auction/types";

export type OrgOnboardingQueryOptions = {
  entityId?: string;
  fresh?: boolean;
  subkind?: string;
};

/** Build query string for org onboarding step URLs. */
export function buildOrgOnboardingQuery(opts: OrgOnboardingQueryOptions): string {
  const qs = new URLSearchParams();
  if (opts.entityId) qs.set("entityId", opts.entityId);
  if (opts.fresh) qs.set("fresh", "1");
  if (opts.subkind) qs.set("subkind", opts.subkind);
  return qs.toString();
}

/** Path to a specific onboarding step, preserving entity / fresh / subkind params. */
export function orgOnboardingStepHref(
  step: OrgOnboardingStepKey,
  opts: OrgOnboardingQueryOptions = {},
): string {
  const query = buildOrgOnboardingQuery(opts);
  const path = `/onboarding/organisation/step/${step}`;
  return query ? `${path}?${query}` : path;
}

/** First incomplete step key, or null when every step is marked complete. */
export function earliestIncompleteOrgOnboardingStep(
  completedSteps: readonly OrgOnboardingStepKey[],
): OrgOnboardingStepKey | null {
  const done = new Set(completedSteps);
  return ORG_ONBOARDING_STEPS.find((step) => !done.has(step)) ?? null;
}

/** Index of the furthest completed step (-1 when none). */
export function lastCompletedOrgOnboardingStepIndex(
  completedSteps: readonly OrgOnboardingStepKey[],
): number {
  const done = new Set(completedSteps);
  let last = -1;
  for (let i = 0; i < ORG_ONBOARDING_STEPS.length; i += 1) {
    const step = ORG_ONBOARDING_STEPS[i];
    if (step && done.has(step)) last = i;
  }
  return last;
}

/** Resume URL for an existing draft organisation. */
export function orgOnboardingResumeHref(
  entityId: string,
  completedSteps: readonly OrgOnboardingStepKey[],
): string {
  const step = earliestIncompleteOrgOnboardingStep(completedSteps) ?? "type";
  return orgOnboardingStepHref(step, { entityId });
}

/** Step to redirect to when the user jumps ahead, or null when the request is allowed. */
export function resolveBlockedOnboardingStep(
  requestedStep: OrgOnboardingStepKey,
  completedSteps: readonly OrgOnboardingStepKey[],
): OrgOnboardingStepKey | null {
  const missing = earliestIncompleteOrgOnboardingStep(completedSteps);
  if (!missing) return null;

  const requestedIndex = ORG_ONBOARDING_STEPS.indexOf(requestedStep);
  const missingIndex = ORG_ONBOARDING_STEPS.indexOf(missing);
  if (requestedIndex > missingIndex) return missing;
  return null;
}

/** When type is already complete, return the step to skip forward to (or null to stay on type). */
export function resolveTypeStepForwardRedirect(
  completedSteps: readonly OrgOnboardingStepKey[],
): OrgOnboardingStepKey | null {
  if (!completedSteps.includes("type")) return null;
  const missing = earliestIncompleteOrgOnboardingStep(completedSteps);
  if (missing && missing !== "type") return missing;
  return null;
}
