"use client";

import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import {
  type ArchivePageQuery,
  archiveClearFiltersHref,
  buildArchiveActiveFilterChips,
} from "@/lib/archive/build-archive-params";

type Category = { id: string; name: string };

type Props = {
  query: Pick<ArchivePageQuery, "endYear" | "categoryId" | "sortMode">;
  categories: Category[];
  className?: string;
};

/** Removable active filter chips for the archive catalogue. */
export function ArchiveActiveFilters({ query, categories, className }: Props) {
  const chips = buildArchiveActiveFilterChips(query, categories);
  const clearHref = archiveClearFiltersHref();

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref={clearHref}
      {...(className ? { className } : {})}
    />
  );
}
