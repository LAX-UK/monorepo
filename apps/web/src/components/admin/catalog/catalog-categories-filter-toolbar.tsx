"use client";

import { AdminListSearch } from "@/components/admin/admin-list-search";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogFilterBar } from "@/components/admin/catalog/catalog-filter-bar";

type Props = {
  lenses: readonly CatalogSegmentItem[];
  activeLensId: string;
  activeFilterCount: number;
};

export function CatalogCategoriesFilterToolbar({ lenses, activeLensId, activeFilterCount }: Props) {
  return (
    <CatalogFilterBar
      lenses={lenses}
      activeLensId={activeLensId}
      lensAriaLabel="Category archive scope"
      sheetTitle="Category filters"
      activeFilterCount={activeFilterCount}
      searchSlot={<AdminListSearch placeholder="Search categories…" className="w-full" />}
      sheetFilters={
        <p className="font-body text-sm text-on-surface-variant">
          Lens toggles archived categories — search matches names in the tree.
        </p>
      }
    />
  );
}
