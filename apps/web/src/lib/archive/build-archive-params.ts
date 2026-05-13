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
