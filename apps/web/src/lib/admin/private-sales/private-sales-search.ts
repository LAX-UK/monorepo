import { buildListHref } from "@/lib/admin/admin-list-params";
import { DEAL_VIEWS, DEFAULT_DEAL_VIEW, type DealView } from "@auction/domain";
import { DEALS_PATH } from "./private-sales.vm";

export type DealsSearch = Record<string, string | string[] | undefined>;

/** The list's state as the URL carries it. Cursors are opaque; `trail` holds the pages before this one. */
export type DealsFilters = { view: DealView; cursor: string; trail: string[] };

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function parseTrail(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string" && c.length <= 200).slice(-40)
      : [];
  } catch {
    return [];
  }
}

export function parseDealsSearch(sp: DealsSearch): DealsFilters {
  const view = first(sp.view);
  return {
    view: (DEAL_VIEWS as readonly string[]).includes(view) ? (view as DealView) : DEFAULT_DEAL_VIEW,
    cursor: first(sp.cursor).slice(0, 200),
    trail: parseTrail(first(sp.trail)),
  };
}

/** What `GET /admin/private-sales` takes for these filters. */
export function dealsApiQuery(filters: DealsFilters, limit = 25): URLSearchParams {
  const query = new URLSearchParams({ view: filters.view, limit: String(limit) });
  if (filters.cursor) query.set("cursor", filters.cursor);
  return query;
}

type Patch = Record<string, string | number | null | undefined>;

/** The list URL with `patch` applied; any view change returns to the first page. */
export function dealsHref(current: DealsSearch, patch: Patch): string {
  const next: Patch = { cursor: null, trail: null, ...patch };
  // The view people land on keeps the URL clean.
  if (next.view === DEFAULT_DEAL_VIEW) next.view = null;
  return buildListHref(DEALS_PATH, current, next);
}

/** Previous and next links for a cursor list: the pages before this one ride along in `trail`. */
export function dealsPagination(
  current: DealsSearch,
  filters: DealsFilters,
  page: { itemCount: number; nextCursor: string | null },
): { summary: string; prevHref: string | null; nextHref: string | null } | null {
  if (page.itemCount === 0) return null;
  const earlier = filters.trail;
  const previous = earlier.length > 0 ? earlier[earlier.length - 1] : undefined;
  const noun = page.itemCount === 1 ? "deal" : "deals";
  const number = earlier.length + 1;
  return {
    summary:
      number === 1 && !page.nextCursor
        ? `${page.itemCount} ${noun}`
        : `Page ${number} · ${page.itemCount} ${noun}`,
    prevHref:
      previous === undefined
        ? null
        : dealsHref(current, {
            cursor: previous || null,
            trail: earlier.length > 1 ? JSON.stringify(earlier.slice(0, -1)) : null,
            view: filters.view,
          }),
    nextHref: page.nextCursor
      ? dealsHref(current, {
          cursor: page.nextCursor,
          trail: JSON.stringify([...earlier, filters.cursor]),
          view: filters.view,
        })
      : null,
  };
}
