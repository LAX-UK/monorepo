"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { AdminStaffFilterFields } from "@/components/admin/filters/admin-staff-filter-fields";
import { staffFilterAdapter } from "@/lib/admin/filters/staff-filter-adapter";

type Props = {
  activeFilterCount: number;
  activeFilterChips: CatalogActiveFilterChip[];
  toolbarEnd?: React.ReactNode;
};

export function AdminStaffFilterToolbar({
  activeFilterCount,
  activeFilterChips,
  toolbarEnd,
}: Props) {
  return (
    <AdminFilterBar
      sheetTitle="Staff filters"
      sheetFilters={<AdminStaffFilterFields />}
      activeFilterCount={activeFilterCount}
      transactional={{ adapter: staffFilterAdapter, preserved: {} }}
      searchSlot={<AdminListSearch placeholder="Name or email" className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
