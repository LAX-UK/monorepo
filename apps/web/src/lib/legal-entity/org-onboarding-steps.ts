import type { OrgOnboardingStepKey } from "@auction/types";
import { ORG_ONBOARDING_STEPS } from "@auction/types";

export type OrgOnboardingStepMeta = {
  key: OrgOnboardingStepKey;
  label: string;
  /** Rough time hint for progress UI. */
  estimatedMinutes?: number;
};

/** Canonical wizard step order and display labels for org onboarding. */
export const ORG_ONBOARDING_STEP_META: readonly OrgOnboardingStepMeta[] = [
  { key: "type", label: "Type", estimatedMinutes: 2 },
  { key: "details", label: "Details", estimatedMinutes: 5 },
  { key: "documents", label: "Documents", estimatedMinutes: 5 },
  { key: "connect", label: "Connect", estimatedMinutes: 5 },
  { key: "identity", label: "Identity", estimatedMinutes: 3 },
] as const;

const STEP_KEY_SET = new Set<string>(ORG_ONBOARDING_STEPS);

/** Parse `/onboarding/organisation/step/{key}` segment into a step key, or null. */
export function orgOnboardingStepKeyFromPathname(pathname: string): OrgOnboardingStepKey | null {
  const segment = pathname.match(/\/onboarding\/organisation\/step\/([^/]+)/)?.[1];
  if (!segment || !STEP_KEY_SET.has(segment)) return null;
  return segment as OrgOnboardingStepKey;
}

export function orgOnboardingStepIndex(stepKey: OrgOnboardingStepKey): number {
  return ORG_ONBOARDING_STEP_META.findIndex((step) => step.key === stepKey);
}

/** Timeline stages for dashboard onboarding progress UI. */
export const ORG_ONBOARDING_TIMELINE_STAGES = ORG_ONBOARDING_STEP_META.map((step) => ({
  id: step.key,
  label: step.label,
}));
