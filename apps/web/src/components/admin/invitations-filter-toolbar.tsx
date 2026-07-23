"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { AdminInvitationsFilterFields } from "@/components/admin/filters/admin-invitations-filter-fields";
import { InvitationsListSearch } from "@/components/admin/invitations-list-search";
import { invitationsFilterAdapter } from "@/lib/admin/filters/invitations-filter-adapter";

type Props = {
  activeFilterCount: number;
  activeFilterChips: CatalogActiveFilterChip[];
};

export function InvitationsFilterToolbar({ activeFilterCount, activeFilterChips }: Props) {
  return (
    <AdminFilterBar
      sheetTitle="Invitation filters"
      sheetFilters={<AdminInvitationsFilterFields />}
      activeFilterCount={activeFilterCount}
      transactional={{ adapter: invitationsFilterAdapter, preserved: {} }}
      searchSlot={<InvitationsListSearch placeholder="Search by email" className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
    />
  );
}
