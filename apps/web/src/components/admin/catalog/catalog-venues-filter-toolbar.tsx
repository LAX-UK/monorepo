"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";
import { AdminVenuesFilterFields } from "@/components/admin/filters/admin-venues-filter-fields";
import { venuesFilterAdapter } from "@/lib/admin/filters/venues-filter-adapter";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  legalEntityId?: string | null;
  legalEntityDisplayName?: string | null;
};

export function CatalogVenuesFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips = [],
  legalEntityDisplayName,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Venue archive scope"
      sheetTitle="Venue filters"
      activeFilterCount={activeFilterCount}
      showFilterTrigger
      searchSlot={<AdminListSearch placeholder="Search venues…" className="w-full" />}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      sheetFilters={
        <AdminVenuesFilterFields legalEntityDisplayName={legalEntityDisplayName ?? null} />
      }
      transactional={{
        adapter: venuesFilterAdapter,
        preserved: activeLensId === "archived" ? { includeArchived: "true" } : {},
      }}
    />
  );
}
