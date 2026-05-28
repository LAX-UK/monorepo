import { artistDirectoryWithQuery } from "@/lib/artists/directory-url";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";

export type ArtistDirectoryActiveFilterChip = {
  key: string;
  label: string;
  removeHref: string;
};

export type ArtistDirectoryFilterState = {
  canonicalPath: string;
  searchParams: Record<string, string | string[] | undefined>;
  layoutView: CatalogLayoutView;
  q?: string;
  nationalityFromQuery?: string;
  nationalityIsLocked: boolean;
  decadeFromQuery?: string;
  decadeIsLocked: boolean;
  hasUpcoming: boolean;
  sort: "name_asc" | "popular" | "recent";
};

const SORT_LABELS: Record<"popular" | "recent", string> = {
  popular: "Most lots",
  recent: "Recently added",
};

function formatDecadeLabel(decade: string): string {
  if (/^\d{4}s$/.test(decade)) return `Born ${decade}`;
  return decade;
}

/** Removable active filter chips for the artist directory toolbar strip. */
export function buildArtistDirectoryActiveFilterChips(
  state: ArtistDirectoryFilterState,
): ArtistDirectoryActiveFilterChip[] {
  const {
    canonicalPath,
    searchParams,
    layoutView,
    q,
    nationalityFromQuery,
    nationalityIsLocked,
    decadeFromQuery,
    decadeIsLocked,
    hasUpcoming,
    sort,
  } = state;

  const chips: ArtistDirectoryActiveFilterChip[] = [];
  const basePatch = { offset: null, view: layoutView } as const;

  if (q) {
    chips.push({
      key: "q",
      label: `Search: “${q}”`,
      removeHref: artistDirectoryWithQuery(canonicalPath, searchParams, {
        ...basePatch,
        q: null,
      }),
    });
  }

  if (nationalityFromQuery && !nationalityIsLocked) {
    chips.push({
      key: "nationality",
      label: nationalityFromQuery,
      removeHref: artistDirectoryWithQuery(canonicalPath, searchParams, {
        ...basePatch,
        nationality: null,
      }),
    });
  }

  if (decadeFromQuery && !decadeIsLocked) {
    chips.push({
      key: "decade",
      label: formatDecadeLabel(decadeFromQuery),
      removeHref: artistDirectoryWithQuery(canonicalPath, searchParams, {
        ...basePatch,
        decade: null,
      }),
    });
  }

  if (hasUpcoming) {
    chips.push({
      key: "hasUpcoming",
      label: "Has upcoming lots",
      removeHref: artistDirectoryWithQuery(canonicalPath, searchParams, {
        ...basePatch,
        hasUpcoming: null,
      }),
    });
  }

  if (sort !== "name_asc") {
    chips.push({
      key: "sort",
      label: SORT_LABELS[sort],
      removeHref: artistDirectoryWithQuery(canonicalPath, searchParams, {
        ...basePatch,
        sort: null,
      }),
    });
  }

  return chips;
}

export function artistDirectoryClearFiltersHref(
  canonicalPath: string,
  layoutView: CatalogLayoutView,
): string {
  return artistDirectoryWithQuery(canonicalPath, {}, { view: layoutView });
}
