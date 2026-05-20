import { AdminEmptyState } from "@/components/admin/admin-empty-state";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListExportLink } from "@/components/admin/admin-list-export-link";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { AdminSubmissionsBoard } from "@/components/admin/admin-submissions-board";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogSubmissionsFilterToolbar } from "@/components/admin/catalog/catalog-submissions-filter-toolbar";
import {
  type SubmissionDecisionQueue,
  submissionsListController,
} from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { submissionsDecisionQueueHref } from "@/lib/admin/list-presets/submissions-presets";
import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { Suspense } from "react";

const DECISION_TABS: { id: SubmissionDecisionQueue; label: string }[] = [
  { id: "awaiting", label: "Awaiting" },
  { id: "accepted", label: "Accepted" },
  { id: "rejected", label: "Rejected" },
];

function legacyStatusLabel(searchParams: Record<string, string | string[] | undefined>) {
  const st = Array.isArray(searchParams.status)
    ? searchParams.status[0]
    : (searchParams.status ?? "");
  if (!st || st === "all") return null;
  return st.replaceAll("_", " ");
}

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    queue?: string;
    error?: string;
    q?: string;
    limit?: string;
    offset?: string;
  }>;
}) {
  const sp = await searchParams;
  const error = sp.error ? decodeURIComponent(sp.error) : null;
  const query = submissionsListController.parseQuery(sp);
  const initialQ = query.q ?? "";
  const activeQueue = query.queue ?? ("awaiting" as SubmissionDecisionQueue);
  const legacyLabel = legacyStatusLabel(sp);

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
    ...(query.status !== undefined
      ? { status: query.status }
      : { status: "", queue: query.queue ?? "awaiting" }),
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
          ...(query.queue === "awaiting"
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

  const activeLensId: string = query.status !== undefined ? "__legacy__" : String(activeQueue);

  const activeFilterCount = initialQ.trim() !== "" ? 1 : 0;

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

  const scopeDescription =
    query.status !== undefined
      ? (legacyLabel ?? "matching your filters")
      : ({
          awaiting: "awaiting decision (submitted or under review)",
          accepted: "accepted (approved or converted)",
          rejected: "rejected",
        }[activeQueue] ?? "matching your filters");

  const emptyNoQuery =
    !loadError && rows.length === 0 && !initialQ ? (
      <AdminEmptyState
        title={
          query.status !== undefined
            ? `No submissions with legacy status "${legacyLabel ?? ""}"`
            : `Nothing in "${DECISION_TABS.find((t) => t.id === activeQueue)?.label ?? "this queue"}"`
        }
        description={
          query.status !== undefined
            ? "This bookmarked status filter matched no rows."
            : `There are no submissions ${scopeDescription} right now.`
        }
      />
    ) : null;

  const emptyTitleOnly =
    !loadError && initialQ && rows.length === 0 ? (
      <AdminEmptyState
        title="No matches"
        description={`No submissions match "${initialQ}" in this ${query.status !== undefined ? `legacy filter (${legacyLabel ?? ""})` : "queue"} view. Try another search term or clear the filter.`}
        action={
          <Button variant="secondary" asChild>
            <Link href={clearTitleHref}>Clear search</Link>
          </Button>
        }
      />
    ) : null;

  const board =
    !loadError && submissionRows.length > 0 ? (
      <>
        {kpiTiles}
        <AdminSubmissionsBoard rows={submissionRows} />
      </>
    ) : null;

  return (
    <CatalogListShell
      title="Submissions"
      description="Staff decision queue: approve to create draft lots or reject with a clear reason."
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
            activeLensId={activeLensId}
            activeFilterCount={activeFilterCount}
            initialQ={initialQ}
            {...(query.queue !== undefined ? { queue: query.queue } : {})}
            {...(query.status !== undefined ? { status: query.status } : {})}
          />
        </Suspense>
      }
      toolbarEnd={<AdminListExportLink />}
      errorAlert={
        <>
          {errorAlert}
          {query.status !== undefined ? (
            <p className="font-body text-xs text-on-surface-variant">
              Using legacy bookmark <span className="font-mono">{String(sp.status ?? "")}</span>.{" "}
              <Link href="/admin/submissions" className="text-primary underline">
                Switch to queues
              </Link>
              .
            </p>
          ) : null}
        </>
      }
      mobileSummary={
        !loadError && submissionRows.length > 0 ? (
          <p className="font-body text-sm text-on-surface-variant">
            {submissionRows.length} on page
            {total > 0 ? ` · ${total} total` : ""}
          </p>
        ) : null
      }
    >
      {board}
      {emptyNoQuery}
      {emptyTitleOnly}
      {pagination}
    </CatalogListShell>
  );
}
