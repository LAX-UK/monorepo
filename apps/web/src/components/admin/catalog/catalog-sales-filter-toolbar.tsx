"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";
import type { ReactNode } from "react";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  sheetFilters: ReactNode;
};

export function CatalogSalesFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
  sheetFilters,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Sale lifecycle"
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Search by sale title…" className="w-full" />}
      sheetTitle="Sale filters"
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetFilters={sheetFilters}
    />
  );
}
