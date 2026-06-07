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
  IN_SALE_BASE_PATH,
  IN_SALE_STATUS_OPTIONS,
  type InSaleFilters,
  buildInSaleHref,
  countInSaleSheetFilters,
  getInSaleActiveFilters,
} from "@/lib/dashboard/filters/in-sale/in-sale-filters";
import { useMemo, useState } from "react";

type Props = {
  filters: InSaleFilters;
};

export function InSaleListToolbar({ filters }: Props) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [desktopSheetOpen, setDesktopSheetOpen] = useState(false);
  const activeFilters = useMemo(() => getInSaleActiveFilters(filters), [filters]);
  const sheetFilterCount = countInSaleSheetFilters(filters);

  const statusItems = IN_SALE_STATUS_OPTIONS.map((opt) => ({
    id: opt.value,
    label: opt.label,
    href: buildInSaleHref(filters, { status: opt.value }),
    active: opt.value === filters.status,
  }));

  const statusFilterRow = <DashboardFilterChipRow label="Status" items={statusItems} />;

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Lot filters"
      trigger={<DashboardFilterTrigger activeCount={sheetFilterCount} />}
    >
      {statusFilterRow}
    </DashboardFilterSheet>
  );

  const desktopFilterSheet = (
    <DashboardFilterSheet
      open={desktopSheetOpen}
      onOpenChange={setDesktopSheetOpen}
      title="Lot filters"
      trigger={<DashboardFilterTrigger activeCount={sheetFilterCount} />}
    >
      {statusFilterRow}
    </DashboardFilterSheet>
  );

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter lots"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Filter by lot or sale title"
            placeholder="Search by lot or sale title"
            inputId="in-sale-q"
          />
        }
        mobileFilterSheet={mobileFilterSheet}
        filterSheet={desktopFilterSheet}
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={IN_SALE_BASE_PATH} />
    </div>
  );
}
