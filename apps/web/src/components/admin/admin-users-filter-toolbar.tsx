"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminListSearch } from "@/components/admin/admin-list-search";
import { AdminUsersSavedViews } from "@/components/admin/admin-users-saved-views";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import { AdminUsersFilterFields } from "@/components/admin/filters/admin-users-filter-fields";
import { usersFilterAdapter } from "@/lib/admin/filters/users-filter-adapter";
import type { UsersListFilters } from "@/lib/admin/users-list-query";

type Props = {
  filterDefaults: UsersListFilters;
  activeFilterCount: number;
  activeFilterChips: readonly CatalogActiveFilterChip[];
  searchPlaceholder?: string;
  sheetTitle?: string;
  toolbarEnd?: React.ReactNode;
};

export function AdminUsersFilterToolbar({
  activeFilterCount,
  activeFilterChips,
  searchPlaceholder = "Search by name, email, or mobile…",
  sheetTitle = "Client filters",
  toolbarEnd,
}: Props) {
  return (
    <AdminFilterBar
      sheetTitle={sheetTitle}
      sheetFilters={<AdminUsersFilterFields />}
      activeFilterCount={activeFilterCount}
      transactional={{ adapter: usersFilterAdapter, preserved: {} }}
      searchSlot={<AdminListSearch placeholder={searchPlaceholder} className="w-full" />}
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={
        <>
          <AdminUsersSavedViews />
          {toolbarEnd}
        </>
      }
    />
  );
}
