import { AdminListPage } from "@/components/admin/admin-list-page";
import { AdminSubmissionsBoard } from "@/components/admin/admin-submissions-board";
import type { AdminSubmissionTableRow } from "@/components/admin/admin-submissions-data-table";
import { AdminSubmissionsTitleFilterForm } from "@/components/admin/admin-submissions-title-filter-form";
import { FilterChipRow } from "@/components/admin/filter-chip-row";
import { submissionsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { ItemSubmissionStatus } from "@auction/types";
import { PaginationFooter } from "@auction/ui";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { Button } from "@auction/ui/components/button";
import { EmptyState } from "@auction/ui/components/empty-state";
import Link from "next/link";
import { Suspense } from "react";

const statusChips: { value: ItemSubmissionStatus | ""; label: string }[] = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "converted", label: "Converted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "draft", label: "Draft" },
];

export default async function AdminSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
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
      createdAtLabel: s.createdAt.toLocaleString(),
    };
  });

  const clearTitleHref = buildListHref("/admin/submissions", sp, {
    ...(query.status !== undefined ? { status: query.status } : { status: "" }),
    q: "",
    offset: 0,
  });

  const statusChipsRow = (
    <FilterChipRow
      label="Filter by submission status"
      chips={statusChips.map((chip) => ({
        id: chip.value || "all",
        label: chip.label,
        href: buildListHref("/admin/submissions", sp, {
          status: chip.value ? chip.value : "",
          q: initialQ,
          offset: 0,
        }),
        active:
          (chip.value === "" && query.status === undefined) ||
          (chip.value !== "" && chip.value === query.status),
      }))}
    />
  );

  const filters = (
    <div className="flex w-full flex-col gap-4">
      <Suspense
        fallback={
          <div
            className="min-h-11 rounded-md border border-border-hairline bg-surface-container-low/40"
            aria-hidden
          />
        }
      >
        <AdminSubmissionsTitleFilterForm initialQ={initialQ} status={query.status} />
      </Suspense>
    </div>
  );

  const pagination =
    !loadError && total > 0 && (query.offset > 0 || query.offset + rows.length < total) ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        total={total}
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
      <Alert variant="destructive">
        <AlertTitle>Could not load submissions</AlertTitle>
        <AlertDescription>{loadError ?? error}</AlertDescription>
      </Alert>
    ) : null;

  const hasFilters = Boolean(query.status !== undefined || initialQ);

  const activeStatusLabel =
    statusChips.find((c) => c.value === query.status)?.label.toLowerCase() ?? null;

  const emptyNoQuery =
    !loadError && rows.length === 0 && !initialQ ? (
      <EmptyState
        title={
          query.status !== undefined ? `No ${activeStatusLabel} submissions` : "No submissions"
        }
        description={
          query.status !== undefined
            ? `There are no submissions with status "${activeStatusLabel}" matching your filters.`
            : "The intake queue is empty."
        }
      />
    ) : null;

  const emptyTitleOnly =
    !loadError && initialQ && rows.length === 0 ? (
      <EmptyState
        title="No matches"
        description={`No submissions match "${initialQ}"${query.status !== undefined ? ` with status "${activeStatusLabel}"` : ""}. Try another search term or clear the filter.`}
        action={
          <Button variant="secondary" asChild>
            <Link href={clearTitleHref}>Clear search</Link>
          </Button>
        }
      />
    ) : null;

  const view =
    !loadError && submissionRows.length > 0 ? (
      <AdminSubmissionsBoard rows={submissionRows} />
    ) : null;

  return (
    <AdminListPage
      title="Submissions"
      description="Review seller intake. Start review on submitted items, then approve (creates a draft lot) or reject with a clear reason."
      hasFilters={hasFilters}
      resetHref="/admin/submissions"
      errorAlert={errorAlert}
      chips={statusChipsRow}
      filters={filters}
      view={view}
      empty={
        <>
          {emptyNoQuery}
          {emptyTitleOnly}
        </>
      }
      pagination={pagination}
    />
  );
}
