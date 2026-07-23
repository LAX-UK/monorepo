"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { AdminPayoutsFilterFields } from "@/components/admin/filters/admin-payouts-filter-fields";
import { payoutsFilterAdapter } from "@/lib/admin/filters/payouts-filter-adapter";

type Props = {
  legalEntityId?: string;
  status?: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  toolbarEnd?: React.ReactNode;
};

export function PayoutsFilterToolbar({
  status,
  activeFilterCount,
  activeFilterChips = [],
  toolbarEnd,
}: Props) {
  return (
    <AdminFilterBar
      sheetTitle="Payout filters"
      sheetFilters={<AdminPayoutsFilterFields />}
      activeFilterCount={activeFilterCount}
      transactional={{
        adapter: payoutsFilterAdapter,
        preserved: status ? { status } : {},
      }}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
