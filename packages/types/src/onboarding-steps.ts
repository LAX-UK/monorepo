/** Ordered keys for organisation multi-step onboarding (Phase D). */
export const ORG_ONBOARDING_STEPS = [
  "type",
  "details",
  "documents",
  "connect",
  "identity",
] as const;

export type OrgOnboardingStepKey = (typeof ORG_ONBOARDING_STEPS)[number];
