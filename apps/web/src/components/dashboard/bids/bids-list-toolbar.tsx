"use client";

import {
  DashboardActiveFilters,
  DashboardListToolbar,
  DashboardSearchField,
} from "@/components/dashboard/filters";
import {
  BIDS_BASE_PATH,
  type BidsFilters,
  buildBidsTabHref,
  getBidsActiveFilters,
} from "@/lib/dashboard/filters/bids/bids-filters";
import { useMemo } from "react";
import type { ReactNode } from "react";

type Props = {
  filters: BidsFilters;
  actions?: ReactNode;
};

export function BidsListToolbar({ filters, actions }: Props) {
  const activeFilters = useMemo(() => getBidsActiveFilters(filters), [filters]);

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter bids"
        actions={actions}
        actionsOverflowLabel="Bid actions"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Filter by lot title"
            placeholder="e.g. oil on canvas"
            inputId="bids-q"
          />
        }
      />
      <DashboardActiveFilters
        filters={activeFilters}
        clearAllHref={buildBidsTabHref(filters.tab, "")}
      />
    </div>
  );
}

export { buildBidsTabHref, BIDS_BASE_PATH };
