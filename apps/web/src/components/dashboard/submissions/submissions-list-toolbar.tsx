"use client";

import {
  DashboardActiveFilters,
  DashboardListToolbar,
  DashboardSearchField,
} from "@/components/dashboard/filters";
import {
  SUBMISSIONS_BASE_PATH,
  type SubmissionsFilters,
  buildSubmissionsHref,
  getSubmissionsActiveFilters,
} from "@/lib/dashboard/filters/submissions/submissions-filters";
import { useMemo } from "react";

type Props = {
  filters: SubmissionsFilters;
};

export function SubmissionsListToolbar({ filters }: Props) {
  const activeFilters = useMemo(() => getSubmissionsActiveFilters(filters), [filters]);

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter submissions"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Title contains"
            placeholder="Search within loaded results…"
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
