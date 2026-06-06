import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogRelatedWork } from "@/components/admin/catalog/catalog-related-work";
import { CatalogSubmissionsFilterToolbar } from "@/components/admin/catalog/catalog-submissions-filter-toolbar";
import { AdminSubmissionsBoard } from "@/components/admin/submissions-board";
import { ExportButton } from "@/components/exports/export-button";
import {
  type SubmissionDecisionQueue,
  submissionsListController,
} from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildSubmissionsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { submissionsDecisionQueueHref } from "@/lib/admin/list-presets/submissions-presets";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminCategoryById, getAdminLegalEntityById } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Submissions",
  "Review seller submissions and decision queues.",
);

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

  const sellerIds = [
    ...new Set(
      rows.map((s) => s.legalEntityId ?? s.sellerId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const sellerNameEntries = await Promise.all(
    sellerIds.map(async (id) => {
      const entity = await getAdminLegalEntityById(id).catch(() => null);
      return [id, entity?.displayName ?? null] as const;
    }),
  );
  const sellerNameById = new Map(sellerNameEntries);

  const submissionRows: AdminSubmissionTableRow[] = rows.map((s) => {
    const entityId = s.legalEntityId ?? s.sellerId ?? "";
    const sellerPreview = entityId
      ? (sellerNameById.get(entityId) ?? `ID: ${entityId.slice(0, 8)}…`)
      : "Unknown seller";
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

  const [navCounts, categories] = await Promise.all([
    getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS),
    (async () => {
      try {
        return await (await getServerCategoryReader()).tree();
      } catch {
        return [];
      }
    })(),
  ]);

  const activeFilterChips = buildSubmissionsActiveFilterChips(sp, {
    ...(initialQ ? { q: initialQ } : {}),
    ...(query.categoryId
      ? { categoryId: query.categoryId, categoryName: categoryFilter?.name ?? null }
      : {}),
  });

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
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

  const empty =
    !loadError && rows.length === 0 ? (
      initialQ || query.categoryId ? (
        <CatalogListEmptyState
          title="No matches"
          description="No submissions match your filters in this queue. Try another search term or clear filters."
          action={
            <div className="flex flex-wrap gap-2">
              {initialQ ? (
                <Button variant="secondary" asChild>
                  <Link href={clearTitleHref}>Clear search</Link>
                </Button>
              ) : null}
              <Button variant="secondaryOutline" asChild>
                <Link
                  href={buildListHref("/admin/submissions", sp, {
                    categoryId: undefined,
                    q: "",
                    offset: 0,
                  })}
                >
                  View all in queue
                </Link>
              </Button>
            </div>
          }
        />
      ) : (
        <CatalogListEmptyState
          title={`Nothing in "${DECISION_TABS.find((t) => t.id === activeQueue)?.label ?? "this queue"}"`}
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
      <AdminSubmissionsBoard rows={submissionRows} />
    ) : null;

  return (
    <CatalogListShell
      title="Submissions"
      description="Staff decision queue: approve to create draft lots or reject with a clear reason."
      meta={<CatalogRelatedWork variant="submissions" navCounts={navCounts} />}
      kpiStrip={kpiTiles}
      empty={empty}
      pagination={pagination}
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
            activeFilterChips={activeFilterChips}
            initialQ={initialQ}
            initialCategoryId={query.categoryId ?? null}
            categories={categories}
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
            metrics={[
              { id: "page", label: "On page", value: String(submissionRows.length) },
              { id: "total", label: "Total", value: String(total) },
            ]}
          />
        ) : null
      }
    >
      {board}
    </CatalogListShell>
  );
}
