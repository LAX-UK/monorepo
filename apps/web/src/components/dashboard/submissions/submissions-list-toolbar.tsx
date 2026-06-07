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
  SUBMISSION_STATUS_VALUES,
  type SubmissionStatusCounts,
  type SubmissionsFilters,
  buildSubmissionsHref,
  countSubmissionsSheetFilters,
  getSubmissionsActiveFilters,
  submissionStatusTabLabel,
} from "@/lib/dashboard/filters/submissions/submissions-filters";
import type { SubmissionListFilterValues } from "@auction/validators";
import { useMemo, useState } from "react";

export type { SubmissionStatusCounts };

type Props = {
  filters: SubmissionsFilters;
  initialStatus: SubmissionListFilterValues["status"];
  statusCounts?: SubmissionStatusCounts;
};

export function SubmissionsListToolbar({ filters, initialStatus, statusCounts }: Props) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [desktopSheetOpen, setDesktopSheetOpen] = useState(false);
  const activeFilters = useMemo(() => getSubmissionsActiveFilters(filters), [filters]);
  const sheetFilterCount = countSubmissionsSheetFilters(filters);

  const statusItems = SUBMISSION_STATUS_VALUES.map((status) => ({
    id: status,
    label: submissionStatusTabLabel(status, statusCounts),
    href: buildSubmissionsHref(filters, { status }),
    active: initialStatus === status,
  }));

  const statusFilterRow = <DashboardFilterChipRow label="Status" items={statusItems} />;

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Submission filters"
      trigger={<DashboardFilterTrigger activeCount={sheetFilterCount} />}
    >
      {statusFilterRow}
    </DashboardFilterSheet>
  );

  const desktopFilterSheet = (
    <DashboardFilterSheet
      open={desktopSheetOpen}
      onOpenChange={setDesktopSheetOpen}
      title="Submission filters"
      trigger={<DashboardFilterTrigger activeCount={sheetFilterCount} />}
    >
      {statusFilterRow}
    </DashboardFilterSheet>
  );

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter submissions"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Title contains"
            placeholder="Search by title…"
            inputId="submissions-q"
          />
        }
        mobileFilterSheet={mobileFilterSheet}
        filterSheet={desktopFilterSheet}
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={SUBMISSIONS_BASE_PATH} />
    </div>
  );
}

export { SUBMISSIONS_BASE_PATH };
