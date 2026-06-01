"use client";

import { AdminFilterBar, type AdminFilterLens } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { FilterSelect } from "@/components/ui/filter-select";
import {
  legalEntityKindFilterOptions,
  legalEntityStatusFilterOptions,
} from "@/lib/admin/legal-entity-list-presenter";

const selectCls = "h-10 w-full font-body text-sm";
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

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
  const sheetFilters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Status</span>
        <FilterSelect
          param="status"
          resetParams={{ offset: "0" }}
          className={selectCls}
          ariaLabel="Legal entity status"
          options={[{ value: "", label: "Any status" }, ...legalEntityStatusFilterOptions()]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Kind</span>
        <FilterSelect
          param="kind"
          resetParams={{ offset: "0" }}
          className={selectCls}
          ariaLabel="Legal entity kind"
          options={[{ value: "", label: "Any kind" }, ...legalEntityKindFilterOptions()]}
        />
      </div>
    </div>
  );

  return (
    <AdminFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Legal entities view"
      sheetTitle="Legal entity filters"
      sheetFilters={sheetFilters}
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Organisation or entity name" className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
