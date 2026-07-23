import { buildListHref, parseListSearchParams } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { toApiOnboardingTab } from "@/lib/data/http/admin-onboarding-issues.shared";
import {
  ONBOARDING_TAB_IDS,
  type OnboardingTabId,
  parseOnboardingTab,
} from "@/lib/data/view-models/admin-onboarding-issues.vm";

export const ONBOARDING_ISSUES_LIST_PATH = "/admin/onboarding-issues";

export type OnboardingIssuesListSearchParams = Record<string, string | string[] | undefined> & {
  tab?: string;
  item?: string;
  limit?: string;
  offset?: string;
};

export function buildOnboardingIssuesListPageModel(sp: OnboardingIssuesListSearchParams) {
  const base = parseListSearchParams(sp);
  const limit = Math.min(200, Math.max(1, base.limit));
  const offset = Math.max(0, base.offset);
  const tab = parseOnboardingTab(sp.tab);
  const selectedItemId =
    (typeof sp.item === "string" ? sp.item : sp.item?.[0])?.trim() || undefined;

  const listQueryParams = {
    tab: toApiOnboardingTab(tab),
    limit,
    offset,
  };

  return {
    basePath: ONBOARDING_ISSUES_LIST_PATH,
    query: { offset, limit, tab },
    listQueryParams,
    selectedItemId,
    listReturnTarget: buildAdminListReturnTarget(ONBOARDING_ISSUES_LIST_PATH, sp),
    buildPaginationHref: (patch: Record<string, string | number | undefined>) =>
      buildListHref(ONBOARDING_ISSUES_LIST_PATH, sp, patch),
    buildTabHref: (nextTab: OnboardingTabId) =>
      buildListHref(ONBOARDING_ISSUES_LIST_PATH, sp, {
        tab: nextTab,
        item: "",
        offset: "",
      }),
    tabHrefs: Object.fromEntries(
      ONBOARDING_TAB_IDS.map((tabId) => [
        tabId,
        buildListHref(ONBOARDING_ISSUES_LIST_PATH, sp, {
          tab: tabId,
          item: "",
          offset: "",
        }),
      ]),
    ) as Record<OnboardingTabId, string>,
    buildItemHref: (itemId: string | null) =>
      buildListHref(ONBOARDING_ISSUES_LIST_PATH, sp, itemId ? { item: itemId } : { item: "" }),
    tabIds: ONBOARDING_TAB_IDS,
  };
}

export type OnboardingIssuesListPageModel = ReturnType<typeof buildOnboardingIssuesListPageModel>;
