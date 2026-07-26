import "server-only";

import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import { getFinanceAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminFinanceIssues } from "@/lib/data/http/admin.server";

export type FinanceHubPageModel = {
  financeIssues: Awaited<ReturnType<typeof getAdminFinanceIssues>> | null;
  navCounts: typeof EMPTY_ADMIN_NAV_COUNTS;
  anomalies: ReturnType<typeof detectAnomaliesFromNavCounts>;
  failedPayouts: number;
  loadError: string | null;
};

/** Data/composition boundary for `/admin/finance` hub. */
export async function loadAdminFinanceHubPage(): Promise<FinanceHubPageModel> {
  let financeIssues: Awaited<ReturnType<typeof getAdminFinanceIssues>> | null = null;
  let financeIssuesLoadError: string | null = null;
  try {
    financeIssues = await getAdminFinanceIssues();
  } catch (e) {
    financeIssuesLoadError = e instanceof Error ? e.message : "Could not load finance KPI data.";
    financeIssues = null;
  }

  let navCounts = EMPTY_ADMIN_NAV_COUNTS;
  try {
    navCounts = await getFinanceAdminNavCounts();
  } catch {
    /* use empty */
  }

  const failedPayouts = financeIssues?.failedPayoutCount ?? navCounts.payoutsFailed;
  const anomalies = detectAnomaliesFromNavCounts(navCounts, {
    failedPayouts,
  });

  return {
    financeIssues,
    navCounts,
    anomalies,
    failedPayouts,
    loadError: financeIssuesLoadError,
  };
}
