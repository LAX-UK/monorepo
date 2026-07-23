"use client";

import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
};

/** Sticky bar — queue lenses and applied filter chips only (filters live in board drawer). */
export function CatalogSubmissionsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Submission status"
      showSearch={false}
      showFilterTrigger={false}
      activeFilterCount={activeFilterCount}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
    />
  );
}
