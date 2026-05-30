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
  BIDS_BASE_PATH,
  type BidTab,
  type BidsFilters,
  buildBidsHref,
  buildBidsTabHref,
  getBidsActiveFilters,
} from "@/lib/dashboard/filters/bids/bids-filters";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

type TabCounts = {
  active: number;
  won: number;
  lost: number;
};

type Props = {
  filters: BidsFilters;
  tabCounts: TabCounts;
  actions?: ReactNode;
};

const TAB_OPTIONS: { id: BidTab; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export function BidsListToolbar({ filters, tabCounts, actions }: Props) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const activeFilters = useMemo(() => getBidsActiveFilters(filters), [filters]);
  const mobileSheetCount = filters.tab !== "active" ? 1 : 0;

  const tabItems = TAB_OPTIONS.map((option) => ({
    id: option.id,
    label: (
      <span className="inline-flex items-center gap-2">
        <span>{option.label}</span>
        {tabCounts[option.id] > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] tabular-nums">
            {tabCounts[option.id]}
          </span>
        ) : null}
      </span>
    ),
    href: buildBidsTabHref(option.id, filters.q),
    active: filters.tab === option.id,
  }));

  const tabFilterRow = <DashboardFilterChipRow label="Bid status" items={tabItems} />;

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Bid filters"
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount + (filters.q ? 1 : 0)} />}
    >
      {tabFilterRow}
    </DashboardFilterSheet>
  );

  return (
    <div className="space-y-3">
      <div className="hidden lg:block">{tabFilterRow}</div>
      <DashboardListToolbar
        searchLabel="Filter bids"
        actions={actions}
        actionsOverflowLabel="Bid actions"
        mobileFilterSheet={mobileFilterSheet}
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
        clearAllHref={buildBidsHref(filters, { tab: "active", q: null })}
      />
    </div>
  );
}

export { buildBidsTabHref, BIDS_BASE_PATH };
