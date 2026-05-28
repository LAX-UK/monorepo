import { buildActiveFilterDescriptors, hasActiveFilters } from "../filter-active";
import {
  buildFilterHref,
  countActiveFilterDimensions,
  parseCommaSeparatedIds,
  patchFilterParams,
  toggleCommaSeparatedId,
} from "../filter-params";
import type { ActiveFilterDescriptor, FilterParamsRecord, ListPageFilterConfig } from "../types";

export const WATCHLIST_BASE_PATH = "/dashboard/watchlist";

export type WatchlistSortOption = "addedDesc" | "endingSoon" | "priceAsc" | "priceDesc";
export type WatchlistStatusFilter = "active" | "scheduled" | "ended";

export type WatchlistFilters = {
  sort: WatchlistSortOption;
  status?: WatchlistStatusFilter;
  categoryIds: string[];
  q: string;
};

export const WATCHLIST_SORT_OPTIONS: readonly { value: WatchlistSortOption; label: string }[] = [
  { value: "addedDesc", label: "Recently added" },
  { value: "endingSoon", label: "Ending soon" },
  { value: "priceAsc", label: "Price low to high" },
  { value: "priceDesc", label: "Price high to low" },
] as const;

export const WATCHLIST_STATUS_OPTIONS: readonly {
  value: WatchlistStatusFilter;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "ended", label: "Ended" },
] as const;

export const WATCHLIST_FILTER_DEFAULTS: Record<string, string | undefined> = {
  sort: "addedDesc",
  status: undefined,
  categoryIds: undefined,
  q: undefined,
};

export const WATCHLIST_FILTER_CONFIG: ListPageFilterConfig = {
  basePath: WATCHLIST_BASE_PATH,
  defaults: WATCHLIST_FILTER_DEFAULTS,
  filters: [
    {
      kind: "search",
      param: "q",
      label: "Filter by lot title",
      placeholder: "e.g. oil on canvas",
    },
    {
      kind: "chips",
      param: "status",
      label: "Status",
      options: WATCHLIST_STATUS_OPTIONS.map((o) => ({ id: o.value, label: o.label })),
      placement: "primary",
    },
    {
      kind: "select",
      param: "sort",
      label: "Sort",
      options: WATCHLIST_SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
    {
      kind: "multi-select",
      param: "categoryIds",
      label: "Category",
      options: [],
      placement: "sheet",
    },
  ],
};

const SORT_VALUES = new Set(WATCHLIST_SORT_OPTIONS.map((o) => o.value));
const STATUS_VALUES = new Set(WATCHLIST_STATUS_OPTIONS.map((o) => o.value));

export function parseWatchlistParams(raw: {
  sort?: string;
  status?: string;
  categoryIds?: string;
  q?: string;
}): WatchlistFilters {
  const sort = SORT_VALUES.has(raw.sort as WatchlistSortOption)
    ? (raw.sort as WatchlistSortOption)
    : "addedDesc";
  const status =
    raw.status && STATUS_VALUES.has(raw.status as WatchlistStatusFilter)
      ? (raw.status as WatchlistStatusFilter)
      : undefined;
  const categoryIds = parseCommaSeparatedIds(raw.categoryIds);
  const q = (raw.q ?? "").trim();
  return {
    sort,
    ...(status ? { status } : {}),
    categoryIds,
    q,
  };
}

export function watchlistFiltersToParams(filters: WatchlistFilters): FilterParamsRecord {
  return {
    sort: filters.sort,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.categoryIds.length > 0 ? { categoryIds: filters.categoryIds.join(",") } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  };
}

export function buildWatchlistHref(
  current: WatchlistFilters,
  patch: Partial<{
    sort: WatchlistSortOption;
    status: WatchlistStatusFilter | null;
    categoryIds: string[];
    q: string | null;
  }>,
): string {
  const next: WatchlistFilters = {
    sort: patch.sort ?? current.sort,
    categoryIds: patch.categoryIds ?? current.categoryIds,
    q: patch.q === undefined ? current.q : (patch.q ?? ""),
  };
  if (patch.status === null) {
    // omit status
  } else if (patch.status !== undefined) {
    next.status = patch.status;
  } else if (current.status) {
    next.status = current.status;
  }

  return buildFilterHref(WATCHLIST_BASE_PATH, watchlistFiltersToParams(next), {
    omitDefaults: WATCHLIST_FILTER_DEFAULTS,
  });
}

export function hasWatchlistActiveFilters(filters: WatchlistFilters): boolean {
  return hasActiveFilters(watchlistFiltersToParams(filters), WATCHLIST_FILTER_DEFAULTS, [
    "sort",
    "status",
    "categoryIds",
    "q",
  ]);
}

export function getWatchlistActiveFilters(
  filters: WatchlistFilters,
  categoryNames: Record<string, string>,
): ActiveFilterDescriptor[] {
  const params = watchlistFiltersToParams(filters);
  const sortLabel =
    WATCHLIST_SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort;
  const statusLabel =
    WATCHLIST_STATUS_OPTIONS.find((o) => o.value === filters.status)?.label ?? filters.status;

  return buildActiveFilterDescriptors(
    {
      basePath: WATCHLIST_BASE_PATH,
      params,
      defaults: WATCHLIST_FILTER_DEFAULTS,
      omitDefaults: WATCHLIST_FILTER_DEFAULTS,
    },
    [
      {
        param: "q",
        isActive: (p) => Boolean(typeof p.q === "string" && p.q.trim()),
        label: (p) => `Search: ${typeof p.q === "string" ? p.q : ""}`,
        clearPatch: () => ({ q: undefined }),
      },
      {
        param: "status",
        isActive: () => Boolean(filters.status),
        label: () => statusLabel ?? "Status",
        clearPatch: () => ({ status: undefined }),
      },
      {
        param: "sort",
        isActive: () => filters.sort !== "addedDesc",
        label: () => sortLabel,
        clearPatch: () => ({ sort: undefined }),
      },
      {
        param: "categoryIds",
        isActive: () => filters.categoryIds.length > 0,
        label: () => {
          if (filters.categoryIds.length === 1) {
            const id = filters.categoryIds[0];
            return categoryNames[id ?? ""] ?? "Category";
          }
          return `${filters.categoryIds.length} categories`;
        },
        clearPatch: () => ({ categoryIds: undefined }),
      },
    ],
  );
}

export function countWatchlistSheetFilters(filters: WatchlistFilters): number {
  return countActiveFilterDimensions(watchlistFiltersToParams(filters), WATCHLIST_FILTER_DEFAULTS, [
    "categoryIds",
  ]);
}

/** Active dimensions in the mobile filter sheet (status, categories, sort). */
export function countWatchlistMobileSheetFilters(filters: WatchlistFilters): number {
  return countActiveFilterDimensions(watchlistFiltersToParams(filters), WATCHLIST_FILTER_DEFAULTS, [
    "status",
    "categoryIds",
    "sort",
  ]);
}

export function toggleWatchlistCategory(
  current: WatchlistFilters,
  categoryId: string,
): WatchlistFilters {
  return {
    ...current,
    categoryIds: toggleCommaSeparatedId(current.categoryIds, categoryId),
  };
}

export function patchWatchlistFilters(
  current: WatchlistFilters,
  patch: Partial<WatchlistFilters>,
): WatchlistFilters {
  const merged = patchFilterParams(watchlistFiltersToParams(current), {
    sort: patch.sort,
    status: patch.status,
    categoryIds:
      patch.categoryIds !== undefined
        ? patch.categoryIds.length > 0
          ? patch.categoryIds.join(",")
          : undefined
        : undefined,
    q: patch.q !== undefined ? patch.q || undefined : current.q || undefined,
  });
  return parseWatchlistParams({
    ...(typeof merged.sort === "string" ? { sort: merged.sort } : {}),
    ...(typeof merged.status === "string" ? { status: merged.status } : {}),
    ...(typeof merged.categoryIds === "string" ? { categoryIds: merged.categoryIds } : {}),
    ...(typeof merged.q === "string" ? { q: merged.q } : {}),
  });
}

/** Categories beyond this count use sheet on desktop too. */
export const WATCHLIST_INLINE_CATEGORY_THRESHOLD = 6;
