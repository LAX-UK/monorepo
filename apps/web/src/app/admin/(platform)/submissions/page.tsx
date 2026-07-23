import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogSubmissionsFilterToolbar } from "@/components/admin/catalog/catalog-submissions-filter-toolbar";
import { AdminSubmissionsBoard } from "@/components/admin/submissions-board";
import { SubmissionReviewDrawerFromPreview } from "@/components/admin/submissions/submission-review-drawer-from-preview";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { buildSubmissionsListKpiTiles } from "@/lib/admin/submissions/build-submissions-list-kpi-tiles";
import { loadSubmissionReview } from "@/lib/admin/submissions/load-submission-review";
import { loadAdminSubmissionsListPage } from "@/lib/admin/submissions/load-submissions-list-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { SUBMISSIONS_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Submissions",
  "Review seller submissions and staff decisions.",
);

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    queue?: string;
    error?: string;
    q?: string;
    categoryId?: string;
    qualityGaps?: string;
    assignedTo?: string;
    sort?: string;
    limit?: string;
    offset?: string;
    preview?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireAdminCapability(SUBMISSIONS_ACCESS, "/admin/submissions");
  const error = safeDecodeAdminErrorParam(sp.error);
  const previewId = sp.preview?.trim() ?? "";
  const [vm, previewReview] = await Promise.all([
    loadAdminSubmissionsListPage({ sp, currentUserId: user.id }),
    previewId ? loadSubmissionReview(previewId, user.id) : Promise.resolve(null),
  ]);
  const {
    model,
    summary,
    loadError,
    rows,
    submissionRows,
    total,
    categories,
    activeFilterChips,
    qualityGapsOnPage,
    awaitingOnPage,
  } = vm;
  const { query, activeQueue, advancedFilterCount, exportFilters } = model;
  const lenses = model.lenses.map((lens) => ({
    ...lens,
    ...(lens.id === "awaiting"
      ? { badge: summary.queueCounts.awaiting }
      : lens.id === "accepted"
        ? { badge: summary.queueCounts.accepted }
        : lens.id === "rejected"
          ? { badge: summary.queueCounts.rejected }
          : {}),
  }));
  const kpiStrip = !loadError ? (
    <AdminTrendKpiBand
      ariaLabel="Submissions summary"
      tiles={buildSubmissionsListKpiTiles({
        summary,
        periodDays: 30,
        qualityGapsOnPage,
      })}
    />
  ) : null;

  const boardPagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total)
      ? {
          offset: query.offset,
          limit: query.limit,
          countOnPage: rows.length,
          total,
          prevHref:
            query.offset > 0
              ? model.buildPaginationHref({ offset: Math.max(0, query.offset - query.limit) })
              : null,
          nextHref:
            query.offset + rows.length < total
              ? model.buildPaginationHref({ offset: query.offset + query.limit })
              : null,
        }
      : null;

  const boardFilterControls = {
    searchPlaceholder: "Search submissions…",
    sheetTitle: "Submission filters",
    activeFilterCount: advancedFilterCount,
    searchInputId: "admin-submissions-table-search",
  };

  const submissionFilterSheet = {
    categories,
    queue: activeQueue,
  };

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load submissions">{loadError ?? error}</AdminListAlert>
    ) : null;

  const scopeDescription = {
    awaiting: "awaiting decision (submitted or under review)",
    accepted: "accepted (approved or converted)",
    rejected: "rejected",
  }[activeQueue];

  const empty =
    !loadError && rows.length === 0 ? (
      model.initialQ || query.categoryId ? (
        <CatalogListEmptyState
          title="No matches"
          description="No submissions match your filters. Try another search term or clear filters."
          action={
            <div className="flex flex-wrap gap-2">
              {model.initialQ ? (
                <Button variant="secondary" asChild>
                  <Link href={model.clearTitleHref}>Clear search</Link>
                </Button>
              ) : null}
              <Button variant="secondaryOutline" asChild>
                <Link href={model.clearFiltersHref}>View all submissions</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <CatalogListEmptyState
          title={`Nothing in "${model.decisionTabs.find((t) => t.id === activeQueue)?.label ?? "this list"}"`}
          description={`There are no submissions ${scopeDescription} right now.`}
          action={
            <Button variant="secondaryOutline" asChild>
              <Link href="/admin/submissions">View all submissions</Link>
            </Button>
          }
        />
      )
    ) : null;

  const board =
    !loadError && submissionRows.length > 0 ? (
      <AdminSubmissionsBoard
        rows={submissionRows}
        filterControls={boardFilterControls}
        submissionFilterSheet={submissionFilterSheet}
        exportFilters={exportFilters}
        pagination={boardPagination}
        listTotalCount={total}
      />
    ) : null;

  return (
    <CatalogListShell
      title="Submissions"
      description="Review seller submissions: approve to create draft lots or reject with a clear reason."
      breadcrumbs={
        <CatalogBreadcrumbs
          segments={[{ label: "Admin", href: "/admin" }, { label: "Submissions" }]}
        />
      }
      kpiStrip={kpiStrip}
      empty={empty}
      filterBar={
        <Suspense
          fallback={
            <div
              className="min-h-[3.25rem] rounded-md border border-border-hairline bg-surface-container-low/40"
              aria-hidden
            />
          }
        >
          <CatalogSubmissionsFilterToolbar
            lenses={lenses}
            activeLensId={activeQueue}
            activeFilterCount={advancedFilterCount}
            activeFilterChips={activeFilterChips}
          />
        </Suspense>
      }
      errorAlert={errorAlert}
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "awaiting", label: "Awaiting", value: String(summary.awaitingReview) },
              { id: "assigned", label: "Assigned", value: String(summary.assignedToMe) },
              { id: "sla", label: "Over SLA", value: String(summary.overSla) },
              ...(activeQueue === "awaiting"
                ? [
                    {
                      id: "page",
                      label: "On page",
                      value: String(awaitingOnPage),
                    },
                  ]
                : []),
            ]}
          />
        ) : null
      }
    >
      {board}
      {previewReview ? <SubmissionReviewDrawerFromPreview loaded={previewReview} /> : null}
    </CatalogListShell>
  );
}
