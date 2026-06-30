"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { InvitationsListSearch } from "@/components/admin/invitations-list-search";
import { filterSelectTriggerClassName } from "@/components/ui/filter-select";
import { useInvitationsListNuqs } from "@/lib/admin/invitations-list-nuqs";
import { invitationStatusFilterOptions } from "@/lib/admin/invitations-list-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";

const labelCapsCls =
  "font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary";

type Props = {
  activeFilterCount: number;
  activeFilterChips: CatalogActiveFilterChip[];
};

export function InvitationsFilterToolbar({ activeFilterCount, activeFilterChips }: Props) {
  const [filters, setFilters] = useInvitationsListNuqs();
  const statusValue = filters.status || "__all__";

  const sheetFilters = (
    <div className="space-y-4">
      <div className="flex flex-col gap-1">
        <span className={labelCapsCls}>Status</span>
        <Select
          value={statusValue}
          onValueChange={(next) => {
            const raw = next === "__all__" ? "" : next;
            void setFilters({ status: raw || null, offset: 0 });
          }}
        >
          <SelectTrigger className={filterSelectTriggerClassName} aria-label="Invitation status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent className="z-[var(--z-floating,70)]">
            <SelectItem value="__all__">All statuses</SelectItem>
            {invitationStatusFilterOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <AdminFilterBar
      sheetTitle="Invitation filters"
      sheetFilters={sheetFilters}
      activeFilterCount={activeFilterCount}
      searchSlot={<InvitationsListSearch placeholder="Search by email" className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
    />
  );
}
