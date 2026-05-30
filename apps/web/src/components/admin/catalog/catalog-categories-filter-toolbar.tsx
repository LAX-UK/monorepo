"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
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
      sheetTitle="Category filters"
      activeFilterCount={activeFilterCount}
      showFilterTrigger={false}
      searchSlot={<AdminListSearch placeholder="Search categories…" className="w-full" />}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetFilters={
        <p className="font-body text-sm text-on-surface-variant">
          Search matches names and slugs server-side. Lens toggles archived categories.
        </p>
      }
    />
  );
}
