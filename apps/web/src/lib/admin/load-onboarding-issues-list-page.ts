import "server-only";

import {
  type OnboardingIssuesListSearchParams,
  buildOnboardingIssuesListPageModel,
} from "@/lib/admin/build-onboarding-issues-list-page-model";
import {
  type OnboardingListSearch,
  type OnboardingStaffRow,
  onboardingListHref,
  onboardingRangeSummary,
  toOnboardingStaffRow,
  toOnboardingStaffRows,
} from "@/lib/admin/onboarding-issues-staff-list.vm";
import {
  findAdminOnboardingIssueInLens,
  getAdminOnboardingIssuesPage,
} from "@/lib/data/http/admin-onboarding-issues.reader";
import { EMPTY_ADMIN_ONBOARDING_ISSUES_CROSS_SUMMARY } from "@/lib/data/http/admin-onboarding-issues.shared";
import { mapOnboardingCrossSummary } from "@/lib/data/view-models/admin-onboarding-issues.vm";

/** Shown in place of the rows; the raw failure stays in the server logs. */
const ONBOARDING_LOAD_ERROR = "We could not load the onboarding issues. Try again in a moment.";
const ONBOARDING_FORBIDDEN = "You do not have access to onboarding issues.";

/** The search params as plain strings, so the client can build queue and paging links. */
function plainSearch(sp: OnboardingIssuesListSearchParams): OnboardingListSearch {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function loadAdminOnboardingIssuesListPage(sp: OnboardingIssuesListSearchParams) {
  const model = buildOnboardingIssuesListPageModel(sp);
  const search = plainSearch(sp);
  const { tab, offset, limit } = model.query;

  try {
    const selectedId = model.selectedItemId;
    const page = await getAdminOnboardingIssuesPage(model.listQueryParams);
    const selectedFromPage = selectedId
      ? (page.rows.find((row) => row.id === selectedId) ?? null)
      : null;
    const selectedOffPage =
      selectedId && !selectedFromPage
        ? await findAdminOnboardingIssueInLens(model.listQueryParams.tab, selectedId, {
            pageSize: limit,
            knownTotal: page.total,
          })
        : null;
    const selectedRow = selectedFromPage ?? selectedOffPage;
    const rows = toOnboardingStaffRows(tab, page.rows, model.listReturnTarget);
    const selected = selectedRow
      ? toOnboardingStaffRow(tab, selectedRow, model.listReturnTarget)
      : null;

    return {
      search,
      tab,
      rows,
      selected,
      selectedId: selectedId ?? null,
      /** An item was asked for by link and is no longer in this queue. */
      previewDegraded: Boolean(selectedId && !selected),
      queueSummary: mapOnboardingCrossSummary(page.summary),
      lensSummary: page.lensSummary,
      offset,
      total: page.total,
      loadError: null as string | null,
      pageSize: limit,
      pagination:
        rows.length > 0
          ? {
              summary: onboardingRangeSummary(offset, rows.length, page.total),
              prevHref:
                offset > 0
                  ? onboardingListHref(search, { offset: Math.max(0, offset - limit) })
                  : null,
              nextHref: page.hasNextPage
                ? onboardingListHref(search, { offset: offset + limit })
                : null,
            }
          : null,
    };
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "forbidden";
    return {
      search,
      tab,
      rows: [] as OnboardingStaffRow[],
      selected: null as OnboardingStaffRow | null,
      selectedId: null,
      previewDegraded: false,
      queueSummary: mapOnboardingCrossSummary(EMPTY_ADMIN_ONBOARDING_ISSUES_CROSS_SUMMARY),
      lensSummary: null,
      offset,
      total: 0,
      loadError: forbidden ? ONBOARDING_FORBIDDEN : ONBOARDING_LOAD_ERROR,
      pageSize: limit,
      pagination: null,
    };
  }
}

export type AdminOnboardingIssuesListPage = Awaited<
  ReturnType<typeof loadAdminOnboardingIssuesListPage>
>;
