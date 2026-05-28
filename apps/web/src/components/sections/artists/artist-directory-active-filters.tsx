"use client";

import { CatalogActiveFilterChips } from "@/components/marketing/catalog-active-filter-chips";
import {
  type ArtistDirectoryFilterState,
  artistDirectoryClearFiltersHref,
  buildArtistDirectoryActiveFilterChips,
} from "@/lib/artists/directory-active-filters";

type Props = {
  state: ArtistDirectoryFilterState;
  className?: string;
};

/** Removable active filter chips for the artist directory (parity with search/sales). */
export function ArtistDirectoryActiveFilters({ state, className }: Props) {
  const chips = buildArtistDirectoryActiveFilterChips(state);
  const clearHref = artistDirectoryClearFiltersHref(state.canonicalPath, state.layoutView);

  return (
    <CatalogActiveFilterChips
      chips={chips}
      clearHref={clearHref}
      {...(className ? { className } : {})}
    />
  );
}
