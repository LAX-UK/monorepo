"use client";

import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-segment-nav";

type StickyProps = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
};

/** Sticky bar — lens tabs and applied chips only (search/filters live in the table card header). */
export function CatalogLotsStickyFilterToolbar({
  lenses,
  activeLensId,
  activeFilterChips = [],
}: StickyProps) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Lot status"
      showSearch={false}
      showFilterTrigger={false}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
    />
  );
}
