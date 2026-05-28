"use client";

import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import { SubmissionsMobileList } from "@/components/dashboard/list/submissions-mobile-list";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { SectionTabsNav } from "@/components/dashboard/section-tabs-nav";
import { SubmissionsListToolbar } from "@/components/dashboard/submissions/submissions-list-toolbar";
import { SubmissionStatusBadge } from "@/components/ui/submission-status-badge";
import { DASHBOARD_CTA, DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  buildSubmissionsHref,
  hasSubmissionsActiveFilters,
  parseSubmissionsParams,
} from "@/lib/dashboard/filters/submissions/submissions-filters";
import type { ItemSubmissionStatus } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { DataTable } from "@auction/ui/components/data-table";
import type { SubmissionListFilterValues } from "@auction/validators";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

export type SubmissionTableRow = {
  id: string;
  title: string;
  status: ItemSubmissionStatus;
  updatedAt: string;
};

export type SubmissionStatusCounts = Record<ItemSubmissionStatus | "all", number>;

const filterStatusLabel: Record<SubmissionListFilterValues["status"], string> = {
  all: "All statuses",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  converted: "Converted",
};

const statusTabs: readonly SubmissionListFilterValues["status"][] = [
  "all",
  "draft",
  "submitted",
  "under_review",
  "approved",
  "rejected",
  "withdrawn",
  "converted",
];

function statusHref(status: SubmissionListFilterValues["status"], q: string) {
  return buildSubmissionsHref(parseSubmissionsParams({ status, q }), { status, q });
}

function tabLabel(
  status: SubmissionListFilterValues["status"],
  counts: SubmissionStatusCounts | undefined,
): string {
  const base = filterStatusLabel[status].replace(" statuses", "");
  if (!counts) return base;
  const n = status === "all" ? counts.all : counts[status];
  return n > 0 ? `${base} · ${n}` : base;
}

function submissionColumns(): ColumnDef<SubmissionTableRow>[] {
  return [
    {
      accessorKey: "title",
      header: "Item",
      cell: ({ row }) => (
        <Link
          href={`/dashboard/submissions/${row.original.id}`}
          className="font-headline text-sm text-on-surface underline-offset-4 hover:underline"
        >
          {row.original.title}
        </Link>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <SubmissionStatusBadge status={row.original.status} />,
    },
    {
      accessorKey: "updatedAt",
      header: "Updated",
      accessorFn: (r) => new Date(r.updatedAt).getTime(),
      cell: ({ row }) => (
        <span className="font-body text-xs tabular-nums text-on-surface-variant">
          {new Date(row.original.updatedAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="secondaryOutline"
            className="px-4 py-2 text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
            asChild
          >
            <Link href={`/dashboard/submissions/${row.original.id}`}>View</Link>
          </Button>
          {row.original.status === "draft" ? (
            <Button
              variant="primary"
              className="px-4 py-2 text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
              asChild
            >
              <Link href={`/dashboard/submissions/${row.original.id}`}>Edit</Link>
            </Button>
          ) : null}
        </div>
      ),
      enableSorting: false,
    },
  ];
}

type Props = {
  rows: SubmissionTableRow[];
  initialStatus: SubmissionListFilterValues["status"];
  initialQ: string;
  /** Row count from the API for the current status filter (before title `q` filter on the server page). */
  fetchedCount: number;
  statusCounts?: SubmissionStatusCounts;
};

function StartSubmissionAction() {
  return (
    <Button variant="primary" asChild>
      <Link href={DASHBOARD_ROUTES.submissionsNew}>{DASHBOARD_CTA.newSubmission}</Link>
    </Button>
  );
}

export function SubmissionsBoard({
  rows,
  initialStatus,
  initialQ,
  fetchedCount,
  statusCounts,
}: Props) {
  const router = useRouter();
  const columns = useMemo(() => submissionColumns(), []);
  const filters = parseSubmissionsParams({
    status: initialStatus,
    q: initialQ,
  });

  const clearTitleSearch = useCallback(() => {
    router.replace(buildSubmissionsHref(filters, { q: null }), { scroll: false });
  }, [filters, router]);

  return (
    <div className="space-y-6">
      <SectionTabsNav
        ariaLabel="Submission status"
        sticky={false}
        className="rounded-xl border border-border-hairline bg-surface-container-lowest px-3 max-md:[&_nav]:overflow-x-auto max-md:[&_nav]:flex-nowrap"
        items={statusTabs.map((status) => ({
          href: statusHref(status, filters.q),
          label: tabLabel(status, statusCounts),
          isActive: initialStatus === status,
        }))}
      />

      <SubmissionsListToolbar filters={filters} />

      <DashboardFilterResultsAnnouncer count={rows.length} entityLabel="submissions" />

      {rows.length === 0 ? (
        fetchedCount > 0 && hasSubmissionsActiveFilters(filters) ? (
          <FilterEmptyState
            segment="dashboard"
            entity="submissions"
            title="No title matches"
            description="Nothing in the current list matches that title. Try another phrase or clear the title filter."
            onClearFilters={clearTitleSearch}
          />
        ) : initialStatus !== "all" ? (
          <DashboardEmptyState
            title="Nothing in this status"
            description="Try a different status or start a new submission for specialist review."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button type="button" variant="secondaryOutline" asChild>
                  <Link href={DASHBOARD_ROUTES.submissions}>Show all</Link>
                </Button>
                <StartSubmissionAction />
              </div>
            }
          />
        ) : (
          <DashboardEmptyState
            title={DASHBOARD_EMPTY.submissions.title}
            description={DASHBOARD_EMPTY.submissions.description}
            action={<StartSubmissionAction />}
          />
        )
      ) : (
        <>
          <SubmissionsMobileList rows={rows} />
          <div className="hidden overflow-hidden rounded-xl border border-border-hairline bg-surface-container-lowest shadow-sm lg:block">
            <DataTable columns={columns} data={rows} density="compact" />
          </div>
        </>
      )}
    </div>
  );
}
