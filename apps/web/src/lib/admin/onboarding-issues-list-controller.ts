import { getAdminOnboardingIssues } from "@/lib/data/http/admin.server";
import type { AdminOnboardingIssuesPayload } from "@/lib/data/http/admin.server";
import {
  type OnboardingQueueSummary,
  type OnboardingTabId,
  parseOnboardingTab,
  summarizeOnboardingQueues,
} from "@/lib/data/view-models/admin-onboarding-issues.vm";

export type OnboardingIssuesListQuery = {
  tab: OnboardingTabId;
};

export type OnboardingIssuesListResult = {
  data: AdminOnboardingIssuesPayload;
  summary: OnboardingQueueSummary;
  tab: OnboardingTabId;
};

/** Hub-style queue controller (no pagination — single aggregated payload). */
export const onboardingIssuesListController = {
  id: "onboarding-issues",
  parseQuery(
    searchParams: Record<string, string | string[] | undefined>,
  ): OnboardingIssuesListQuery {
    const tabRaw = searchParams.tab;
    const tabStr =
      typeof tabRaw === "string" ? tabRaw : Array.isArray(tabRaw) ? tabRaw[0] : undefined;
    return { tab: parseOnboardingTab(tabStr) };
  },
  async fetch(query: OnboardingIssuesListQuery): Promise<OnboardingIssuesListResult> {
    const data = await getAdminOnboardingIssues();
    return {
      data,
      summary: summarizeOnboardingQueues(data),
      tab: query.tab,
    };
  },
};
