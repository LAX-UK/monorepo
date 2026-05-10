import type { ReactNode } from "react";

/** Priority: KYC > Org > Email > Other (Phase C adds KYC). */
export const DASHBOARD_BANNER_PRIORITIES = {
  kyc: 100,
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
