"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import {
  CatalogFilterBar,
  type CatalogSegmentItem,
} from "@/components/admin/catalog/catalog-filter-bar";
import type { ReactNode } from "react";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
  /** Server-rendered filter form (e.g. LotFilterOptionsLoader in Suspense). */
  sheetFilters: ReactNode;
};

export function CatalogLotsFilterToolbar({
  lenses,
  activeLensId,
  activeFilterCount,
  sheetFilters,
}: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Lot list view"
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Search lots…" className="w-full" />}
      sheetFilters={sheetFilters}
    />
  );
}
