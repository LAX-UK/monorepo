import "server-only";

import {
  type OnboardingIssuesListSearchParams,
  buildOnboardingIssuesListPageModel,
} from "@/lib/admin/build-onboarding-issues-list-page-model";
import {
  findAdminOnboardingIssueInLens,
  getAdminOnboardingIssuesPage,
} from "@/lib/data/http/admin-onboarding-issues.reader";
import {
  type AdminOnboardingIssueRow,
  EMPTY_ADMIN_ONBOARDING_ISSUES_CROSS_SUMMARY,
} from "@/lib/data/http/admin-onboarding-issues.shared";
import { mapOnboardingCrossSummary } from "@/lib/data/view-models/admin-onboarding-issues.vm";

export async function loadAdminOnboardingIssuesListPage(sp: OnboardingIssuesListSearchParams) {
  const model = buildOnboardingIssuesListPageModel(sp);

  try {
    const selectedId = model.selectedItemId;
    const needsSelectedFetch = selectedId != null && selectedId.length > 0;
    const page = await getAdminOnboardingIssuesPage(model.listQueryParams);
    const selectedFromPage = selectedId
      ? (page.rows.find((row) => row.id === selectedId) ?? null)
      : null;
    const selectedOffPage =
      needsSelectedFetch && !selectedFromPage
        ? await findAdminOnboardingIssueInLens(model.listQueryParams.tab, selectedId, {
            pageSize: model.query.limit,
            knownTotal: page.total,
          })
        : null;
    const selected: AdminOnboardingIssueRow | null = selectedFromPage ?? selectedOffPage;

    return {
      model,
      tab: model.query.tab,
      rows: page.rows,
      selected,
      summary: page.summary,
      queueSummary: mapOnboardingCrossSummary(page.summary),
      lensSummary: page.lensSummary,
      total: page.total,
      hasNextPage: page.hasNextPage,
      loadError: null as string | null,
      previewDegraded: Boolean(selectedId && !selected),
      pagination:
        page.total > 0 && (model.query.offset > 0 || page.hasNextPage)
          ? {
              offset: model.query.offset,
              limit: model.query.limit,
              countOnPage: page.rows.length,
              total: page.total,
              prevHref:
                model.query.offset > 0
                  ? model.buildPaginationHref({
                      offset: Math.max(0, model.query.offset - model.query.limit),
                    })
                  : null,
              nextHref: page.hasNextPage
                ? model.buildPaginationHref({
                    offset: model.query.offset + model.query.limit,
                  })
                : null,
            }
          : null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load onboarding issues.";
    return {
      model,
      tab: model.query.tab,
      rows: [] as AdminOnboardingIssueRow[],
      selected: null as AdminOnboardingIssueRow | null,
      summary: EMPTY_ADMIN_ONBOARDING_ISSUES_CROSS_SUMMARY,
      queueSummary: mapOnboardingCrossSummary(EMPTY_ADMIN_ONBOARDING_ISSUES_CROSS_SUMMARY),
      lensSummary: null,
      total: 0,
      hasNextPage: false,
      loadError: message === "forbidden" ? "Access denied" : message,
      previewDegraded: false,
      pagination: null,
    };
  }
}
