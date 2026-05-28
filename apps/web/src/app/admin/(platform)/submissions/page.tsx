import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminSubmissionsBoard } from "@/components/admin/admin-submissions-board";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogSubmissionsFilterToolbar } from "@/components/admin/catalog/catalog-submissions-filter-toolbar";
import { ExportButton } from "@/components/exports/export-button";
import {
  type SubmissionDecisionQueue,
  submissionsListController,
} from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { submissionsDecisionQueueHref } from "@/lib/admin/list-presets/submissions-presets";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminCategoryById } from "@/lib/data/http/admin.server";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { Suspense } from "react";

const DECISION_TABS: { id: SubmissionDecisionQueue; label: string }[] = [
  { id: "awaiting", label: "Awaiting" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    queue?: string;
    error?: string;
    q?: string;
    categoryId?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = submissionsListController.parseQuery(sp);
  const initialQ = query.q ?? "";
  const activeQueue = query.queue ?? "awaiting";

  let loadError: string | null = null;
  let rows: Awaited<ReturnType<typeof submissionsListController.fetch>>["rows"] = [];
  let total = 0;
  try {
    const result = await submissionsListController.fetch(query);
    rows = result.rows;
    total = result.total ?? rows.length;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const submissionRows: AdminSubmissionTableRow[] = rows.map((s) => {
    const entityId = s.legalEntityId ?? s.sellerId ?? "";
    const sellerPreview = entityId ? `ID: ${entityId.slice(0, 8)}…` : "Unknown seller";
    return {
      id: s.id,
      title: s.title,
      sellerPreview,
      status: s.status,
      createdAtLabel: formatDateTime(s.createdAt),
    };
  });

  const clearTitleHref = buildListHref("/admin/submissions", sp, {
    q: "",
    offset: 0,
    queue: activeQueue,
  });

  const awaitingOnPage = submissionRows.filter(
    (r) => r.status === "under_review" || r.status === "submitted",
  ).length;

  const kpiTiles =
    !loadError && submissionRows.length > 0 ? (
      <AdminListKpiStrip
        ariaLabel="Submissions summary"
        tiles={[
          { label: "On this page", value: submissionRows.length, delta: `of ${total} total` },
          ...(activeQueue === "awaiting"
            ? [
                {
                  label: "Submitted / reviewing",
                  value: awaitingOnPage,
                  delta: "On this page",
                },
              ]
            : []),
        ]}
      />
    ) : null;

  const lenses: CatalogSegmentItem[] = DECISION_TABS.map((tab) => ({
    id: tab.id,
    label: tab.label,
    href: submissionsDecisionQueueHref(tab.id, sp),
  }));

  const activeFilterCount = (initialQ.trim() !== "" ? 1 : 0) + (query.categoryId ? 1 : 0);
  const categoryFilter = query.categoryId
    ? await getAdminCategoryById(query.categoryId).catch(() => null)
    : null;

  const categoryBanner =
    categoryFilter && query.categoryId ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-hairline bg-surface-container-low/40 px-4 py-3 text-sm">
        <p className="text-on-surface">
          Showing submissions tagged with{" "}
          <Link
            href={`/admin/categories/${query.categoryId}`}
            className="font-medium text-primary hover:underline"
          >
            {categoryFilter.name}
          </Link>
        </p>
        <Link
          href={buildListHref("/admin/submissions", sp, { categoryId: undefined, offset: 0 })}
          className="font-label text-xs font-semibold uppercase tracking-wide text-primary hover:underline"
        >
          Clear category filter
        </Link>
      </div>
    ) : null;

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/submissions", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/submissions", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load submissions">{loadError ?? error}</AdminListAlert>
    ) : null;

  const scopeDescription = {
    awaiting: "awaiting decision (submitted or under review)",
    accepted: "accepted (approved or converted)",
    rejected: "rejected",
  }[activeQueue];

  const emptyNoQuery =
    !loadError && rows.length === 0 && !initialQ ? (
      <AdminEmptyState
        title={`Nothing in "${DECISION_TABS.find((t) => t.id === activeQueue)?.label ?? "this queue"}"`}
        description={`There are no submissions ${scopeDescription} right now.`}
      />
    ) : null;

  const emptyTitleOnly =
    !loadError && initialQ && rows.length === 0 ? (
      <AdminEmptyState
        title="No matches"
        description={`No submissions match "${initialQ}" in this queue view. Try another search term or clear the filter.`}
        action={
          <Button variant="secondary" asChild>
            <Link href={clearTitleHref}>Clear search</Link>
          </Button>
        }
      />
    ) : null;

  const board =
    !loadError && submissionRows.length > 0 ? (
      <AdminSubmissionsBoard rows={submissionRows} />
    ) : null;

  return (
    <CatalogListShell
      title="Submissions"
      description="Staff decision queue: approve to create draft lots or reject with a clear reason."
      kpiStrip={kpiTiles}
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
            activeFilterCount={activeFilterCount}
            initialQ={initialQ}
            queue={activeQueue}
          />
        </Suspense>
      }
      toolbarEnd={
        <ExportButton
          entityType="submissions"
          filters={{
            ...(activeQueue ? { queue: activeQueue } : {}),
            ...(initialQ ? { q: initialQ } : {}),
            ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          }}
        />
      }
      errorAlert={errorAlert}
      mobileSummary={
        !loadError && submissionRows.length > 0 ? (
          <CatalogListMobileSummary
            segments={[`${submissionRows.length} on page`, total > 0 ? `${total} total` : null]}
          />
        ) : null
      }
    >
      {categoryBanner}
      {board}
      {emptyNoQuery}
      {emptyTitleOnly}
      {pagination}
    </CatalogListShell>
  );
}
