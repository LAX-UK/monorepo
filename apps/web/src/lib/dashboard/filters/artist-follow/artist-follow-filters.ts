import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import { buildFilterHref } from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const ARTIST_FOLLOW_BASE_PATH = "/dashboard/watchlist";

export const ARTIST_FOLLOW_SECTION = "artists";

export type ArtistFollowSort = "addedDesc" | "nameAsc" | "nameDesc";

export type ArtistFollowFilters = {
  q: string;
  sort: ArtistFollowSort;
};

export const ARTIST_FOLLOW_SORT_OPTIONS: readonly { value: ArtistFollowSort; label: string }[] = [
  { value: "addedDesc", label: "Recently followed" },
  { value: "nameAsc", label: "Name A–Z" },
  { value: "nameDesc", label: "Name Z–A" },
] as const;

export const ARTIST_FOLLOW_FILTER_DEFAULTS: Record<string, string | undefined> = {
  q: undefined,
  sort: "addedDesc",
};

export const ARTIST_FOLLOW_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: ARTIST_FOLLOW_BASE_PATH,
  defaults: ARTIST_FOLLOW_FILTER_DEFAULTS,
  filters: [
    {
      kind: "search",
      param: "q",
      label: "Search artists",
      placeholder: "Filter by artist name…",
    },
    {
      kind: "select",
      param: "sort",
      label: "Sort",
      options: ARTIST_FOLLOW_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
  ],
};

const SORT_VALUES = new Set(ARTIST_FOLLOW_SORT_OPTIONS.map((o) => o.value));

export function parseArtistFollowParams(raw: { q?: string; sort?: string }): ArtistFollowFilters {
  const sort = SORT_VALUES.has(raw.sort as ArtistFollowSort)
    ? (raw.sort as ArtistFollowSort)
    : "addedDesc";
  return {
    q: (raw.q ?? "").trim().slice(0, 200),
    sort,
  };
}

export function artistFollowFiltersToParams(filters: ArtistFollowFilters): FilterParamsRecord {
  return {
    section: ARTIST_FOLLOW_SECTION,
    ...(filters.q ? { q: filters.q } : {}),
    ...(filters.sort !== "addedDesc" ? { sort: filters.sort } : {}),
  };
}

export function buildArtistFollowHref(
  current: ArtistFollowFilters,
  patch: Partial<{ q: string | null; sort: ArtistFollowSort }>,
): string {
  const next: ArtistFollowFilters = {
    q: patch.q === undefined ? current.q : (patch.q ?? "").trim().slice(0, 200),
    sort: patch.sort ?? current.sort,
  };
  return buildFilterHref(ARTIST_FOLLOW_BASE_PATH, artistFollowFiltersToParams(next), {
    omitDefaults: ARTIST_FOLLOW_FILTER_DEFAULTS,
  });
}

export function hasArtistFollowActiveFilters(filters: ArtistFollowFilters): boolean {
  return hasActiveFilters(artistFollowFiltersToParams(filters), ARTIST_FOLLOW_FILTER_DEFAULTS, [
    "q",
    "sort",
  ]);
}

export function getArtistFollowActiveFilters(
  filters: ArtistFollowFilters,
): ActiveFilterDescriptor[] {
  const sortLabel =
    ARTIST_FOLLOW_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort;

  return buildActiveFilterDescriptors(
    {
      basePath: ARTIST_FOLLOW_BASE_PATH,
      params: artistFollowFiltersToParams(filters),
      defaults: ARTIST_FOLLOW_FILTER_DEFAULTS,
      omitDefaults: ARTIST_FOLLOW_FILTER_DEFAULTS,
    },
    [
      {
        param: "q",
        isActive: () => Boolean(filters.q.trim()),
        label: () => `Search: ${filters.q}`,
        clearPatch: () => ({ q: undefined }),
      },
      {
        param: "sort",
        isActive: () => filters.sort !== "addedDesc",
        label: () => sortLabel,
        clearPatch: () => ({ sort: undefined }),
      },
    ],
  );
}

export type ArtistFollowDisplayRow = {
  watchlistId: string;
  artistId: string;
  displayName: string;
  createdAtMs: number;
};

export function filterArtistFollowRows(
  rows: ArtistFollowDisplayRow[],
  q: string,
): ArtistFollowDisplayRow[] {
  const t = q.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((row) => row.displayName.toLowerCase().includes(t));
}

export function sortArtistFollowRows(
  rows: ArtistFollowDisplayRow[],
  sort: ArtistFollowSort,
): ArtistFollowDisplayRow[] {
  const copy = [...rows];
  switch (sort) {
    case "nameAsc":
      return copy.sort((a, b) => a.displayName.localeCompare(b.displayName));
    case "nameDesc":
      return copy.sort((a, b) => b.displayName.localeCompare(a.displayName));
    default:
      return copy.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }
}
