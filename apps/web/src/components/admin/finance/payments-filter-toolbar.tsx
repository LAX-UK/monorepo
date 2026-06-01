"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";

type Props = {
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  toolbarEnd?: React.ReactNode;
};

/** Payments list search via shared admin filter chrome (no filter drawer). */
export function PaymentsFilterToolbar({ activeFilterChips = [], toolbarEnd }: Props) {
  return (
    <AdminFilterBar
      showFilterTrigger={false}
      searchSlot={
        <AdminListSearch placeholder="Search lot, buyer, or payment id…" className="w-full" />
      }
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
