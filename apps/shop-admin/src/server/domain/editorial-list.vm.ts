import {
  EXHIBITION_KINDS,
  type EditorialEntityKind,
  type EditorialPublicationStatus,
} from "@/lib/editorial-entity-forms";
import { STORY_KINDS, STORY_KIND_LABELS } from "@/lib/editorial-story-kinds";
import { formatDateRange } from "@/lib/editorial-time";
import type { EditorialStoryKind } from "@auction/shop-contracts";
import type { RawSearchParams } from "./list-url-state";
import {
  type WorkList,
  type WorkListState,
  type WorkListView,
  defineWorkList,
} from "./work-list.vm";

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
  /** The stored kind of an exhibition or story; null for venues and pages. */
  kind: string | null;
  kindLabel: string | null;
  /** Venues only. */
  city: string | null;
  /** Exhibitions only: "1 Jun 2026 – 30 Jun 2026". */
  dates: string | null;
  updatedAt: string;
};

export const EDITORIAL_EXHIBITION_KIND_LABELS: Record<string, string> = {
  exhibition: "Exhibition",
  film: "Film",
  event: "Event",
};

/** The kinds an entity can be filtered by; none for venues and pages. */
export function editorialKindOptions(
  kind: EditorialEntityKind,
): readonly { value: string; label: string }[] {
  if (kind === "exhibitions") {
    return EXHIBITION_KINDS.map((value) => ({
      value,
      label: EDITORIAL_EXHIBITION_KIND_LABELS[value] ?? value,
    }));
  }
  if (kind === "stories") {
    return STORY_KINDS.map((value) => ({ value, label: STORY_KIND_LABELS[value] }));
  }
  return [];
}

export const EDITORIAL_LIST_SEARCH_MAX_LENGTH = 100;

const VIEWS: readonly WorkListView[] = [
  { id: "all", label: "All", api: {} },
  { id: "published", label: "Published", api: {}, statuses: ["published"] },
  { id: "draft", label: "Drafts", api: {}, statuses: ["draft"] },
];

export type EditorialListFilter = "kind";
export type EditorialListDefinition = WorkList<EditorialListFilter>;
export type EditorialListState = WorkListState<EditorialListFilter>;

const definitions = new Map<EditorialEntityKind, EditorialListDefinition>();

/**
 * The URL rules of one entity's list: view, search, kind filter, sort, page and the record open
 * in the panel. The API returns every row, so all of it is applied here over the full set.
 */
export function editorialList(kind: EditorialEntityKind): EditorialListDefinition {
  const existing = definitions.get(kind);
  if (existing) return existing;
  const created = defineWorkList<EditorialListFilter>({
    path: `/editorial/${kind}`,
    views: VIEWS,
    defaultView: "all",
    filters: { kind: editorialKindOptions(kind).map((option) => option.value) },
    sorts: {
      title: { asc: "title_asc", desc: "title_desc" },
      updated: { asc: "updated_asc", desc: "updated_desc" },
    },
    // The API's own order, newest edit first.
    defaultSort: "updated_desc",
    panelParam: "item",
    searchMaxLength: EDITORIAL_LIST_SEARCH_MAX_LENGTH,
  });
  definitions.set(kind, created);
  return created;
}

export function parseEditorialList(
  kind: EditorialEntityKind,
  params: RawSearchParams,
): EditorialListState {
  return editorialList(kind).parse(params);
}

function descriptorOf(kind: EditorialEntityKind, row: EditorialListApiRow): string | null {
  if (kind === "stories") {
    return STORY_KIND_LABELS[row.kind as EditorialStoryKind] ?? row.kind ?? null;
  }
  if (kind === "exhibitions") {
    return EDITORIAL_EXHIBITION_KIND_LABELS[row.kind ?? ""] ?? row.kind ?? null;
  }
  return null;
}

export function toEditorialListRow(
  kind: EditorialEntityKind,
  row: EditorialListApiRow,
): EditorialListRow {
  const hasKind = kind === "exhibitions" || kind === "stories";
  return {
    id: row.id,
    title: row.label,
    slug: row.slug,
    status: row.status,
    kind: hasKind ? (row.kind ?? null) : null,
    kindLabel: descriptorOf(kind, row),
    city: kind === "venues" ? (row.city ?? null) : null,
    dates:
      kind === "exhibitions" ? formatDateRange(row.startsOn ?? null, row.endsOn ?? null) : null,
    updatedAt: row.updatedAt,
  };
}

/** Where a published item lives on lax.art, as a path; pages sit at addresses of their own. */
export function editorialPublicPath(kind: EditorialEntityKind, slug: string): string | null {
  switch (kind) {
    case "exhibitions":
      return `/exhibitions/${slug}`;
    case "stories":
      return `/stories/${slug}`;
    case "venues":
      return `/visit/${slug}`;
    case "pages":
      return null;
  }
}

/** Case-insensitive match on title and slug. */
export function matchesQuery(row: EditorialListRow, q: string | undefined): boolean {
  const needle = q?.trim().toLowerCase();
  if (!needle) return true;
  return [row.title, row.slug].some((text) => text.toLowerCase().includes(needle));
}

function matchesKind(row: EditorialListRow, kind: string | undefined): boolean {
  return !kind || row.kind === kind;
}

function order(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The full set in the order the sort names. Updated newest first is the API's order (updated,
 * then id, both descending), so each direction is the exact reverse of the other.
 */
export function sortEditorialRows(
  rows: readonly EditorialListRow[],
  sort: { columnId: string; direction: "asc" | "desc" },
): EditorialListRow[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  const primary = (a: EditorialListRow, b: EditorialListRow) =>
    sort.columnId === "title"
      ? a.title.localeCompare(b.title, "en-GB", { sensitivity: "base" })
      : order(a.updatedAt, b.updatedAt);
  return [...rows].sort((a, b) => sign * (primary(a, b) || order(a.id, b.id)));
}

export type EditorialListPage = {
  /** The rows of the requested page. */
  items: EditorialListRow[];
  /** Rows in the open view, after search and filters. */
  total: number;
  /** Rows per status after search and filters, for the view tabs. */
  counts: Record<EditorialPublicationStatus, number>;
  /** 1-based, pulled back to the last page when the URL asks for one past the end. */
  page: number;
  pageSize: number;
  /** "1–50 of 312". */
  range: { from: number; to: number };
  hasPrevious: boolean;
  hasNext: boolean;
};

/** Search, kind filter, view, sort and page over the full set. */
export function editorialListPage(
  kind: EditorialEntityKind,
  rows: readonly EditorialListRow[],
  state: EditorialListState,
): EditorialListPage {
  const list = editorialList(kind);
  const narrowed = rows.filter(
    (row) => matchesQuery(row, state.q) && matchesKind(row, state.filters.kind),
  );
  const counts = {
    published: narrowed.filter((row) => row.status === "published").length,
    draft: narrowed.filter((row) => row.status === "draft").length,
  };
  const inView = narrowed.filter((row) => state.view === "all" || row.status === state.view);
  const sorted = sortEditorialRows(inView, list.sortState(state));
  const pageSize = list.pageSize(state);
  const requested = Number.parseInt(state.cursor ?? "1", 10);
  const lastPage = Math.max(1, Math.ceil(sorted.length / pageSize));
  const page = Math.min(Number.isInteger(requested) && requested > 1 ? requested : 1, lastPage);
  const offset = (page - 1) * pageSize;
  const items = sorted.slice(offset, offset + pageSize);
  return {
    items,
    total: sorted.length,
    counts,
    page,
    pageSize,
    range: { from: items.length === 0 ? 0 : offset + 1, to: offset + items.length },
    hasPrevious: page > 1,
    hasNext: page < lastPage,
  };
}
