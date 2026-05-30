"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogLotsLensNav } from "@/components/admin/catalog/catalog-lots-lens-nav";
import type { ReactNode } from "react";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  /** Server-rendered filter form (e.g. LotFilterOptionsLoader in Suspense). */
  sheetFilters: ReactNode;
};

export function CatalogLotsFilterToolbar({
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
      lensAriaLabel="Lot list view"
      activeFilterCount={activeFilterCount}
      LensNav={CatalogLotsLensNav}
      searchSlot={<AdminListSearch placeholder="Search lots…" className="w-full" />}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetFilters={sheetFilters}
    />
  );
}
