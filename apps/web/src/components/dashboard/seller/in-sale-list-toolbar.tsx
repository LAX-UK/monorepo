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
  countInSaleMobileSheetFilters,
  getInSaleActiveFilters,
} from "@/lib/dashboard/filters/in-sale/in-sale-filters";
import { useMemo, useState } from "react";

type Props = {
  filters: InSaleFilters;
};

export function InSaleListToolbar({ filters }: Props) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const activeFilters = useMemo(() => getInSaleActiveFilters(filters), [filters]);
  const mobileSheetCount = countInSaleMobileSheetFilters(filters);

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
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount} />}
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
        primaryFilters={statusFilterRow}
        mobileFilterSheet={mobileFilterSheet}
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={IN_SALE_BASE_PATH} />
    </div>
  );
}
