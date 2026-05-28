"use client";

import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import {
  type ArchivePageQuery,
  archiveClearFiltersHref,
  buildArchiveActiveFilterChips,
} from "@/lib/archive/build-archive-params";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

type Category = { id: string; name: string };

type Props = {
  query: Pick<ArchivePageQuery, "endYear" | "categoryId" | "sortMode">;
  categories: Category[];
  layoutView: CatalogLayoutView;
  className?: string;
};

/** Removable active filter chips for the archive catalogue. */
export function ArchiveActiveFilters({ query, categories, layoutView, className }: Props) {
  const chips = buildArchiveActiveFilterChips(
    query,
    categories,
    layoutView === "list" ? "list" : undefined,
  );
  const clearHref = archiveClearFiltersHref(layoutView === "list" ? "list" : undefined);

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref={clearHref}
      {...(className ? { className } : {})}
    />
  );
}
