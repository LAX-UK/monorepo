import type { EditorialEntityKind, EditorialPublicationStatus } from "@/lib/editorial-entity-forms";
import { STORY_KIND_LABELS } from "@/lib/editorial-story-kinds";
import { formatDateRange, formatLondonDateTime } from "@/lib/editorial-time";
import type { EditorialStoryKind } from "@auction/shop-contracts";

/** A row from the admin list endpoints. The kind-specific fields are present only for their entity. */
export type EditorialListApiRow = {
  id: string;
  slug: string;
  status: EditorialPublicationStatus;
  label: string;
  updatedAt: string;
  kind?: string;
  startsOn?: string | null;
  endsOn?: string | null;
  city?: string | null;
};

export type EditorialListRow = {
  id: string;
  title: string;
  slug: string;
  status: EditorialPublicationStatus;
  /** Kind for exhibitions and stories, city for venues; null where the entity has neither. */
  descriptor: string | null;
  dates: string | null;
  updated: string;
};

export type EditorialStatusFilter = "all" | EditorialPublicationStatus;

export type EditorialListSearch = { q: string; status: EditorialStatusFilter; page: number };

export const EDITORIAL_LIST_PAGE_SIZE = 25;

const EXHIBITION_KIND_LABELS: Record<string, string> = {
  exhibition: "Exhibition",
  film: "Film",
  event: "Event",
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/** Reads `q`, `status` and `page` from the URL; anything unrecognised falls back to its default. */
export function parseEditorialListSearch(params: {
  q?: string | string[];
  status?: string | string[];
  page?: string | string[];
}): EditorialListSearch {
  const status = first(params.status);
  const page = Number.parseInt(first(params.page), 10);
  return {
    q: first(params.q).trim().slice(0, 100),
    status: status === "published" || status === "draft" ? status : "all",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function descriptorOf(kind: EditorialEntityKind, row: EditorialListApiRow): string | null {
  if (kind === "stories")
    return STORY_KIND_LABELS[row.kind as EditorialStoryKind] ?? row.kind ?? null;
  if (kind === "exhibitions") return EXHIBITION_KIND_LABELS[row.kind ?? ""] ?? row.kind ?? null;
  if (kind === "venues") return row.city ?? null;
  return null;
}

export function toEditorialListRow(
  kind: EditorialEntityKind,
  row: EditorialListApiRow,
): EditorialListRow {
  return {
    id: row.id,
    title: row.label,
    slug: row.slug,
    status: row.status,
    descriptor: descriptorOf(kind, row),
    dates:
      kind === "exhibitions" ? formatDateRange(row.startsOn ?? null, row.endsOn ?? null) : null,
    updated: formatLondonDateTime(row.updatedAt),
  };
}

/** The API returns every row, so search is a case-insensitive match on title, slug and kind or city. */
export function matchesQuery(row: EditorialListRow, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [row.title, row.slug, row.descriptor ?? ""].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

export function filterEditorialRows(
  rows: readonly EditorialListRow[],
  search: Pick<EditorialListSearch, "q" | "status">,
): EditorialListRow[] {
  return rows.filter(
    (row) =>
      matchesQuery(row, search.q) && (search.status === "all" || row.status === search.status),
  );
}

/** Counts for the status chips, taken after search so each chip says what it would show. */
export function statusCounts(
  rows: readonly EditorialListRow[],
  q: string,
): Record<EditorialStatusFilter, number> {
  const matching = rows.filter((row) => matchesQuery(row, q));
  return {
    all: matching.length,
    published: matching.filter((row) => row.status === "published").length,
    draft: matching.filter((row) => row.status === "draft").length,
  };
}

export type EditorialListPage = {
  rows: EditorialListRow[];
  total: number;
  page: number;
  offset: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

/** A page past the end is pulled back to the last page rather than shown empty. */
export function paginateEditorialRows(
  rows: readonly EditorialListRow[],
  requestedPage: number,
  pageSize = EDITORIAL_LIST_PAGE_SIZE,
): EditorialListPage {
  const lastPage = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requestedPage, lastPage);
  const offset = (page - 1) * pageSize;
  return {
    rows: rows.slice(offset, offset + pageSize),
    total: rows.length,
    page,
    offset,
    hasPrevious: page > 1,
    hasNext: page < lastPage,
  };
}

/** List URL for a search state, leaving out defaults so the address stays short and shareable. */
export function editorialListUrl(kind: EditorialEntityKind, search: EditorialListSearch): string {
  const params = new URLSearchParams();
  if (search.q) params.set("q", search.q);
  if (search.status !== "all") params.set("status", search.status);
  if (search.page > 1) params.set("page", String(search.page));
  const query = params.toString();
  return `/editorial/${kind}${query ? `?${query}` : ""}`;
}
