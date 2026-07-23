"use client";

import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";

type Props = {
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  toolbarEnd?: React.ReactNode;
  /** When true, search moves to the board table header (payments list parity). */
  stickyOnly?: boolean;
};

/** Payments list filter chrome — chips in sticky bar; search in board header when stickyOnly. */
export function PaymentsFilterToolbar({
  activeFilterChips = [],
  toolbarEnd,
  stickyOnly = false,
}: Props) {
  return (
    <AdminFilterBar
      showFilterTrigger={false}
      showSearch={!stickyOnly}
      searchSlot={
        stickyOnly ? undefined : (
          <span className="font-body text-sm text-on-surface-variant">Use board search</span>
        )
      }
      activeFilters={
        activeFilterChips.length > 0 ? <CatalogActiveFiltersRow chips={activeFilterChips} /> : null
      }
      toolbarEnd={toolbarEnd}
    />
  );
}
