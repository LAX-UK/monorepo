import { firstString } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { toApiOnboardingTab } from "@/lib/data/http/admin-onboarding-issues.shared";
import { parseOnboardingTab } from "@/lib/data/view-models/admin-onboarding-issues.vm";
import { parseStaffPageSize } from "@auction/staff-ui";

export const ONBOARDING_ISSUES_LIST_PATH = "/admin/onboarding-issues";

export type OnboardingIssuesListSearchParams = Record<string, string | string[] | undefined> & {
  tab?: string;
  item?: string;
  limit?: string;
  offset?: string;
};

/** The list's URL state: the queue (tab), page size, offset and the item whose panel is open. */
export function buildOnboardingIssuesListPageModel(sp: OnboardingIssuesListSearchParams) {
  const limit = parseStaffPageSize(firstString(sp.limit));
  const offset = Math.max(0, Number.parseInt(firstString(sp.offset) ?? "0", 10) || 0);
  const tab = parseOnboardingTab(firstString(sp.tab));
  const selectedItemId = firstString(sp.item)?.trim() || undefined;

  return {
    query: { offset, limit, tab },
    listQueryParams: { tab: toApiOnboardingTab(tab), limit, offset },
    selectedItemId,
    /** Where "back to the list" from a record page returns to. */
    listReturnTarget: buildAdminListReturnTarget(ONBOARDING_ISSUES_LIST_PATH, sp),
  };
}

export type OnboardingIssuesListPageModel = ReturnType<typeof buildOnboardingIssuesListPageModel>;
