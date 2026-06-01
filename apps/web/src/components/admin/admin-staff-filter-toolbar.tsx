"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { FilterSelect } from "@/components/ui/filter-select";
import { staffRoleFilterOptions } from "@/lib/admin/staff-role-presenter";

const selectCls = "h-10 w-full font-body text-sm";
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

type Props = {
  activeFilterCount: number;
  activeFilterChips: CatalogActiveFilterChip[];
  toolbarEnd?: React.ReactNode;
};

export function AdminStaffFilterToolbar({
  activeFilterCount,
  activeFilterChips,
  toolbarEnd,
}: Props) {
  const sheetFilters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Staff role</span>
        <FilterSelect
          param="staffRole"
          resetParams={{ offset: "0" }}
          className={selectCls}
          ariaLabel="Staff role"
          options={[{ value: "", label: "Any role" }, ...staffRoleFilterOptions]}
        />
      </div>
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Status</span>
        <FilterSelect
          param="suspended"
          resetParams={{ offset: "0" }}
          className={selectCls}
          ariaLabel="Staff suspension status"
          options={[
            { value: "", label: "All staff" },
            { value: "1", label: "Suspended only" },
          ]}
        />
      </div>
    </div>
  );

  return (
    <AdminFilterBar
      sheetTitle="Staff filters"
      sheetFilters={sheetFilters}
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Name or email" className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
