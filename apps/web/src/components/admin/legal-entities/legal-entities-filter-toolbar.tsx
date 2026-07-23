"use client";

import { AdminFilterBar, type AdminFilterLens } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { AdminLegalEntitiesFilterFields } from "@/components/admin/filters/admin-legal-entities-filter-fields";
import { legalEntitiesFilterAdapter } from "@/lib/admin/filters/legal-entities-filter-adapter";

type Props = {
  lenses: readonly AdminFilterLens[];
  activeLensId: string;
  activeFilterCount: number;
  activeFilterChips: CatalogActiveFilterChip[];
  toolbarEnd?: React.ReactNode;
};

export function LegalEntitiesFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  activeFilterChips,
  toolbarEnd,
}: Props) {
  return (
    <AdminFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Legal entities view"
      sheetTitle="Legal entity filters"
      sheetFilters={<AdminLegalEntitiesFilterFields />}
      activeFilterCount={activeFilterCount}
      transactional={{
        adapter: legalEntitiesFilterAdapter,
        preserved: activeLensId === "stripe" ? { stripe: "1" } : {},
      }}
      searchSlot={<AdminListSearch placeholder="Organisation or entity name" className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
