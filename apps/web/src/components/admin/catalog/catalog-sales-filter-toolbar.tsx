"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
};

export function CatalogSalesFilterToolbar({ lenses, activeLensId, activeFilterCount }: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Sale lifecycle"
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Search by sale title…" className="w-full" />}
      sheetTitle="Sale filters"
      sheetFilters={
        <p className="font-body text-sm text-on-surface-variant">
          Nothing else yet — lenses and search cover usual triage flows.
        </p>
      }
    />
  );
}
