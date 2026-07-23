"use client";

import {
  type CatalogActiveFilterChip,
  CatalogActiveFiltersRow,
} from "@/components/admin/catalog/catalog-active-filters-row";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";
import type { ReactNode } from "react";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterChips?: readonly CatalogActiveFilterChip[];
  toolbarEnd?: ReactNode;
};

/** Sticky bar — lens tabs and applied chips only (search/filters live in the table card header). */
export function CatalogSalesFilterToolbar({
  lenses,
  activeLensId,
  activeFilterChips = [],
  toolbarEnd,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Sale lifecycle"
      showSearch={false}
      showFilterTrigger={false}
      activeFilters={<CatalogActiveFiltersRow chips={activeFilterChips} />}
      toolbarEnd={toolbarEnd}
    />
  );
}
