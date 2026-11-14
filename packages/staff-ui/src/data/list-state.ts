/*
 * A list's state in its URL: view, search, filters, sort and page or cursor. A plain module (no
 * "use client"), so a server page can read the same state it renders from.
 *
 * Every list keeps this state in the address, so Back, a reload, a shared link and a record's
 * "back to the list" all land on the list exactly as it was (staff design standard, NAV-6, R4).
 */
import type { SortDirection, SortState } from "./types.js";

/** What a list shows and where in it you are. Filters are multi-valued: `?status=a&status=b`. */
export type ListState = {
  view: string | null;
  search: string | null;
  filters: Readonly<Record<string, readonly string[]>>;
  sort: SortState | null;
  page: number | null;
  cursor: string | null;
};

/** The params a list reads, and its defaults; defaults are left out of the URL. */
export type ListStateOptions = {
  /** The filter params the list understands; anything else in the URL is ignored. */
  filters?: readonly string[];
  /** Sortable column ids; a sort on any other column falls back to `defaultSort`. */
  sortable?: readonly string[];
  defaultSort?: SortState;
  defaultView?: string;
};

/** The URL parameter names, the same on every list. */
export const LIST_STATE_PARAMS = {
  view: "view",
  search: "q",
  sort: "sort",
  page: "page",
  cursor: "cursor",
} as const;

type SearchInput =
  | string
  | URLSearchParams
  | Readonly<Record<string, string | readonly string[] | undefined>>;

function toParams(input: SearchInput): URLSearchParams {
  if (typeof input === "string") return new URLSearchParams(input.replace(/^\?/, ""));
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    for (const item of typeof value === "string" ? [value] : value) params.append(key, item);
  }
  return params;
}

/** `created` sorts ascending, `-created` descending. */
export function encodeSort(sort: SortState): string {
  return `${sort.direction === "desc" ? "-" : ""}${sort.columnId}`;
}

export function decodeSort(value: string | null | undefined): SortState | null {
  if (!value) return null;
  const direction: SortDirection = value.startsWith("-") ? "desc" : "asc";
  const columnId = value.replace(/^-/, "");
  return columnId ? { columnId, direction } : null;
}

function sameFilters(
  a: ListState["filters"] | undefined,
  b: ListState["filters"] | undefined,
): boolean {
  const canonical = (filters: ListState["filters"] | undefined) =>
    Object.entries(filters ?? {})
      .filter(([, values]) => values.length > 0)
      .map(([name, values]) => `${name}=${[...values].sort().join(",")}`)
      .sort()
      .join("&");
  return canonical(a) === canonical(b);
}

const sameSort = (a: SortState | null | undefined, b: SortState | null | undefined) =>
  (a?.columnId ?? null) === (b?.columnId ?? null) &&
  (a?.direction ?? null) === (b?.direction ?? null);

/** Reads a list's state from its URL search (a string, URLSearchParams or Next `searchParams`). */
export function parseListState(input: SearchInput, options: ListStateOptions = {}): ListState {
  const params = toParams(input);
  const filters: Record<string, string[]> = {};
  for (const name of options.filters ?? []) {
    const values = params.getAll(name).filter((value) => value !== "");
    if (values.length > 0) filters[name] = values;
  }
  const requested = decodeSort(params.get(LIST_STATE_PARAMS.sort));
  const sortAllowed =
    requested && (!options.sortable || options.sortable.includes(requested.columnId));
  const page = Number.parseInt(params.get(LIST_STATE_PARAMS.page) ?? "", 10);
  return {
    view: params.get(LIST_STATE_PARAMS.view) || options.defaultView || null,
    search: params.get(LIST_STATE_PARAMS.search)?.trim() || null,
    filters,
    sort: sortAllowed ? requested : (options.defaultSort ?? null),
    page: Number.isFinite(page) && page > 1 ? page : null,
    cursor: params.get(LIST_STATE_PARAMS.cursor) || null,
  };
}

/**
 * The URL search for a list state, without the leading "?". Defaults are left out and the order
 * is fixed, so the same list always has the same address.
 */
export function listStateQuery(state: Partial<ListState>, options: ListStateOptions = {}): string {
  const params = new URLSearchParams();
  if (state.view && state.view !== options.defaultView) {
    params.set(LIST_STATE_PARAMS.view, state.view);
  }
  if (state.search?.trim()) params.set(LIST_STATE_PARAMS.search, state.search.trim());
  const filterNames = options.filters ?? Object.keys(state.filters ?? {});
  for (const name of filterNames) {
    for (const value of state.filters?.[name] ?? []) {
      if (value !== "") params.append(name, value);
    }
  }
  if (state.sort && !sameSort(state.sort, options.defaultSort)) {
    params.set(LIST_STATE_PARAMS.sort, encodeSort(state.sort));
  }
  if (state.cursor) params.set(LIST_STATE_PARAMS.cursor, state.cursor);
  else if (state.page && state.page > 1) params.set(LIST_STATE_PARAMS.page, String(state.page));
  return params.toString();
}

/** The list's URL for a state: `/admin/lots?status=live&sort=-ends`. */
export function listStateHref(
  pathname: string,
  state: Partial<ListState>,
  options: ListStateOptions = {},
): string {
  const query = listStateQuery(state, options);
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * The next state after a change. A new view, search, filter or sort starts again from the first
 * page, since the old page or cursor points into a different set of rows.
 */
export function updateListState(current: ListState, change: Partial<ListState>): ListState {
  const next: ListState = { ...current, ...change };
  const paging = "page" in change || "cursor" in change;
  const reshaped =
    ("view" in change && change.view !== current.view) ||
    ("search" in change && change.search !== current.search) ||
    ("filters" in change && !sameFilters(change.filters, current.filters)) ||
    ("sort" in change && !sameSort(change.sort, current.sort));
  if (reshaped && !paging) return { ...next, page: null, cursor: null };
  return next;
}

/** The URL parameter a record page reads to know which list it was opened from. */
export const LIST_QUERY_PARAM = "list";

/**
 * A record's URL that remembers the list it was opened from, so the record page can page through
 * that list (RecordPager) and lead back to it with the same view, search, filters and sort.
 */
export function recordHrefInList(recordHref: string, listQuery: string | null | undefined): string {
  const query = listQuery?.replace(/^\?/, "");
  if (!query) return recordHref;
  const [path = "", hash] = recordHref.split("#");
  const [pathname = "", search = ""] = path.split("?");
  const params = new URLSearchParams(search);
  params.set(LIST_QUERY_PARAM, query);
  return `${pathname}?${params.toString()}${hash !== undefined ? `#${hash}` : ""}`;
}

/** The list query a record page was opened with, or null when it was opened on its own. */
export function listQueryFromRecord(input: SearchInput): string | null {
  return toParams(input).get(LIST_QUERY_PARAM) || null;
}
