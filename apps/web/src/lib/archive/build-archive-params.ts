import type { ListLotsParams } from "@/lib/data/contracts";

export const ARCHIVE_PAGE_SIZE = 18;

export type ArchiveSortMode = "hammer" | "recent" | "artist";

export type ArchivePageQuery = {
  listParams: ListLotsParams;
  page: number;
  pageSize: number;
  sortMode: ArchiveSortMode;
  endYear: number | undefined;
  categoryId: string | undefined;
};

function firstString(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

function parsePositiveInt(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}

function parseYear(v: string | undefined): number | undefined {
  if (!v || v === "all") return undefined;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 1970 || n > 2100) return undefined;
  return n;
}

function parseSort(v: string | undefined): ArchiveSortMode {
  if (v === "recent" || v === "artist") return v;
  return "hammer";
}

/** Map URL search params to API list params for the past-auctions grid.
 * Artist A–Z uses server-side `sellerAsc` (seller display name).
 */
export function buildArchivePageQuery(
  searchParams: Record<string, string | string[] | undefined>,
): ArchivePageQuery {
  const page = parsePositiveInt(firstString(searchParams.page), 1);
  const endYear = parseYear(firstString(searchParams.year));
  const categoryId = firstString(searchParams.categoryId) || undefined;
  const sortMode = parseSort(firstString(searchParams.sort));

  const apiSort: ListLotsParams["sort"] =
    sortMode === "hammer" ? "hammerDesc" : sortMode === "artist" ? "sellerAsc" : "endedDesc";

  const listParams: ListLotsParams = {
    status: "ended",
    ...(categoryId ? { categoryId } : {}),
    ...(endYear !== undefined ? { endYear } : {}),
    sort: apiSort,
    limit: ARCHIVE_PAGE_SIZE,
    offset: (page - 1) * ARCHIVE_PAGE_SIZE,
  };

  return {
    listParams,
    page,
    pageSize: ARCHIVE_PAGE_SIZE,
    sortMode,
    endYear,
    categoryId,
  };
}

export type ArchiveActiveFilterChip = {
  key: string;
  label: string;
  removeHref: string;
};

/** Recent years for archive year chips (matches filter bar). */
export function buildArchiveYearRange(): number[] {
  const current = new Date().getFullYear();
  const start = Math.max(current - 12, 2000);
  const years: number[] = [];
  for (let y = current; y >= start; y -= 1) years.push(y);
  return years;
}

export function archiveSortLabel(sortMode: ArchiveSortMode): string {
  if (sortMode === "recent") return "Most recent";
  if (sortMode === "artist") return "Artist name (A to Z)";
  return "Hammer price (high to low)";
}

/** Count non-default filters for mobile “Filters (N)” badge. */
export function countActiveArchiveFilters(
  q: Pick<ArchivePageQuery, "endYear" | "categoryId" | "sortMode">,
): number {
  let n = 0;
  if (q.endYear !== undefined) n += 1;
  if (q.categoryId !== undefined) n += 1;
  if (q.sortMode !== "hammer") n += 1;
  return n;
}

/** Drop all facet filters; preserve view preference when present. */
export function archiveClearFiltersHref(view?: "grid" | "list"): string {
  if (view === "list") return "/archive?view=list";
  return "/archive";
}

export type ArchiveQueryPatch = {
  endYear?: number | null;
  categoryId?: string | null;
  sortMode?: ArchiveSortMode | null;
  view?: "grid" | "list";
};

/** Merge archive facet updates into a shareable `/archive` URL. */
export function buildArchiveHrefFromQuery(
  current: Pick<ArchivePageQuery, "endYear" | "categoryId" | "sortMode">,
  patch: ArchiveQueryPatch,
  view?: "grid" | "list",
): string {
  const endYear =
    patch.endYear !== undefined
      ? patch.endYear === null
        ? undefined
        : patch.endYear
      : current.endYear;
  const categoryId =
    patch.categoryId !== undefined
      ? patch.categoryId === null
        ? undefined
        : patch.categoryId
      : current.categoryId;
  const sortMode =
    patch.sortMode !== undefined
      ? patch.sortMode === null || patch.sortMode === "hammer"
        ? "hammer"
        : patch.sortMode
      : current.sortMode;

  const q = new URLSearchParams();
  if (endYear !== undefined) q.set("year", String(endYear));
  if (categoryId !== undefined) q.set("categoryId", categoryId);
  if (sortMode !== "hammer") q.set("sort", sortMode);
  const resolvedView = patch.view ?? view;
  if (resolvedView === "list") q.set("view", "list");
  const qs = q.toString();
  return qs ? `/archive?${qs}` : "/archive";
}

/** Removable active filter chips for the archive toolbar strip. */
export function buildArchiveActiveFilterChips(
  q: Pick<ArchivePageQuery, "endYear" | "categoryId" | "sortMode">,
  categories: ReadonlyArray<{ id: string; name: string }>,
  view?: "grid" | "list",
): ArchiveActiveFilterChip[] {
  const chips: ArchiveActiveFilterChip[] = [];

  if (q.endYear !== undefined) {
    chips.push({
      key: "year",
      label: String(q.endYear),
      removeHref: buildArchiveHrefFromQuery(q, { endYear: null }, view),
    });
  }

  if (q.categoryId !== undefined) {
    const name = categories.find((c) => c.id === q.categoryId)?.name ?? "Medium";
    chips.push({
      key: "categoryId",
      label: name,
      removeHref: buildArchiveHrefFromQuery(q, { categoryId: null }, view),
    });
  }

  if (q.sortMode !== "hammer") {
    chips.push({
      key: "sort",
      label: archiveSortLabel(q.sortMode),
      removeHref: buildArchiveHrefFromQuery(q, { sortMode: null }, view),
    });
  }

  return chips;
}
