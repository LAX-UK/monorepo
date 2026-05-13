import type { ReactNode } from "react";

/** Priority: KYC > org onboarding resume > entity status > Email > Other (Phase D). */
export const DASHBOARD_BANNER_PRIORITIES = {
  kyc: 100,
  orgOnboardingResume: 90,
  org: 80,
  email: 40,
  other: 10,
} as const;

export type DashboardBannerCandidate = {
  id: string;
  priority: number;
  node: ReactNode;
};

export function selectTopDashboardBannerCandidates(
  candidates: DashboardBannerCandidate[],
  max = 2,
): DashboardBannerCandidate[] {
  return [...candidates].sort((a, b) => b.priority - a.priority).slice(0, max);
}
