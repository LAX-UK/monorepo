"use client";

import {
  DashboardActiveFilters,
  DashboardFilterChipRow,
  DashboardFilterSheet,
  DashboardFilterTrigger,
  DashboardListToolbar,
  DashboardSearchField,
} from "@/components/dashboard/filters";
import {
  SUBMISSIONS_BASE_PATH,
  type SubmissionsFilters,
  buildSubmissionsHref,
  getSubmissionsActiveFilters,
} from "@/lib/dashboard/filters/submissions/submissions-filters";
import type { SubmissionListFilterValues } from "@auction/validators";
import { useMemo, useState } from "react";

export type SubmissionStatusCounts = Record<SubmissionListFilterValues["status"] | "all", number>;

const filterStatusLabel: Record<SubmissionListFilterValues["status"], string> = {
  all: "All",
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Accepted",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
  converted: "Catalogue prep",
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

function tabLabel(
  status: SubmissionListFilterValues["status"],
  counts: SubmissionStatusCounts | undefined,
): string {
  const base = filterStatusLabel[status];
  if (!counts) return base;
  const n = status === "all" ? counts.all : counts[status];
  return n > 0 ? `${base} · ${n}` : base;
}

type Props = {
  filters: SubmissionsFilters;
  initialStatus: SubmissionListFilterValues["status"];
  statusCounts?: SubmissionStatusCounts;
};

export function SubmissionsListToolbar({ filters, initialStatus, statusCounts }: Props) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const activeFilters = useMemo(() => getSubmissionsActiveFilters(filters), [filters]);
  const mobileSheetCount = (initialStatus !== "all" ? 1 : 0) + (filters.q.trim() ? 1 : 0);

  const statusItems = statusTabs.map((status) => ({
    id: status,
    label: tabLabel(status, statusCounts),
    href: buildSubmissionsHref(filters, { status }),
    active: initialStatus === status,
  }));

  const statusFilterRow = <DashboardFilterChipRow label="Submission status" items={statusItems} />;

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Submission filters"
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount} />}
    >
      {statusFilterRow}
    </DashboardFilterSheet>
  );

  return (
    <div className="space-y-3">
      <div className="hidden lg:block">{statusFilterRow}</div>
      <DashboardListToolbar
        searchLabel="Filter submissions"
        mobileFilterSheet={mobileFilterSheet}
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Title contains"
            placeholder="Search by title…"
            inputId="submissions-q"
          />
        }
      />
      <DashboardActiveFilters
        filters={activeFilters}
        clearAllHref={buildSubmissionsHref(filters, { q: null })}
        clearAllLabel="Clear search"
      />
    </div>
  );
}

export { SUBMISSIONS_BASE_PATH };
