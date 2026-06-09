"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { FilterSelect } from "@/components/ui/filter-select";
import { invitationStatusFilterOptions } from "@/lib/admin/invitations-list-query";

const selectCls = "h-10 w-full font-body text-sm";
const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

type Props = {
  activeFilterCount: number;
  activeFilterChips: CatalogActiveFilterChip[];
};

export function InvitationsFilterToolbar({ activeFilterCount, activeFilterChips }: Props) {
  const sheetFilters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Status</span>
        <FilterSelect
          param="status"
          resetParams={{ offset: "0" }}
          className={selectCls}
          ariaLabel="Invitation status"
          options={[{ value: "", label: "All statuses" }, ...invitationStatusFilterOptions]}
        />
      </div>
    </div>
  );

  return (
    <AdminFilterBar
      sheetTitle="Invitation filters"
      sheetFilters={sheetFilters}
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Search by email" className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
    />
  );
}
