"use client";

import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
};

/** Sticky bar — archive lens and applied chips (search lives in the table card header). */
export function CatalogCategoriesFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Category archive scope"
      showSearch={false}
      showFilterTrigger={false}
      activeFilterCount={activeFilterCount}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
    />
  );
}
