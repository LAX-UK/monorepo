"use client";

import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { ArchiveActiveFilters } from "@/components/sections/archive/archive-active-filters";
import { ArchiveFilterChips } from "@/components/sections/archive/archive-filter-chips";
import { ArchiveFilterSheet } from "@/components/sections/archive/archive-filter-sheet";
import type { ArchivePageQuery } from "@/lib/archive/build-archive-params";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

type Category = { id: string; name: string };

export type ArchivePageToolbarProps = {
  query: Pick<ArchivePageQuery, "endYear" | "categoryId" | "sortMode">;
  resultCount: number;
  categories: Category[];
  layoutView: CatalogLayoutView;
};

/** Sticky archive toolbar: count + filter sheet + desktop quick chips + view. */
export function ArchivePageToolbar({
  query,
  resultCount,
  categories,
  layoutView,
}: ArchivePageToolbarProps) {
  const countLabel = `${resultCount} lot${resultCount === 1 ? "" : "s"}`;
  const resultCountLabel = resultCount === 1 ? "Show 1 lot" : `Show ${resultCount} lots`;

  return (
    <MarketingListToolbar
      countLabel={countLabel}
      mobileFilterTrigger={
        <ArchiveFilterSheet
          query={query}
          categories={categories}
          resultCountLabel={resultCountLabel}
          layoutView={layoutView}
        />
      }
      trailing={<CatalogViewSwitcher routeKey="archive" value={layoutView} />}
      secondaryRow={<ArchiveFilterChips categories={categories} />}
      activeFiltersRow={
        <ArchiveActiveFilters
          query={query}
          categories={categories}
          layoutView={layoutView}
          className="mb-0"
        />
      }
    />
  );
}
