import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  DATA_REQUEST_PRODUCTS,
  DATA_REQUEST_STATUSES,
  DATA_REQUEST_VIEWS,
  type DataRequestListQuery,
  type DataRequestListView,
  type DataRequestProduct,
  dataRequestKindSchema,
  dataRequestReasonSchema,
} from "@auction/identity-contracts/data-requests";
import { searchChipLabel } from "@auction/staff-ui";

export const DATA_REQUESTS_PATH = "/admin/compliance/data-requests";
export const DEFAULT_DATA_REQUESTS_VIEW: DataRequestListView = "open";

export type DataRequestsSearch = Record<string, string | string[] | undefined>;
export type DataRequestsSort = DataRequestListQuery["sort"];

/** The list's state as the URL carries it. Cursors are opaque; `trail` holds the pages before this one. */
export type DataRequestsFilters = {
  view: DataRequestListView;
  status: DataRequestListQuery["status"] | "";
  kind: string;
  product: DataRequestProduct | "";
  q: string;
  sort: DataRequestsSort;
  cursor: string;
  trail: string[];
};

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | "" {
  return (allowed as readonly string[]).includes(value) ? (value as T) : "";
}

function parseTrail(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((c): c is string => typeof c === "string" && c.length <= 512).slice(-40)
      : [];
  } catch {
    return [];
  }
}

export function parseDataRequestsSearch(sp: DataRequestsSearch): DataRequestsFilters {
  const kind = first(sp.kind);
  return {
    view: oneOf(first(sp.view), DATA_REQUEST_VIEWS) || DEFAULT_DATA_REQUESTS_VIEW,
    status: oneOf(first(sp.status), DATA_REQUEST_STATUSES),
    kind:
      dataRequestKindSchema.safeParse(kind).success ||
      dataRequestReasonSchema.safeParse(kind).success
        ? kind
        : "",
    product: oneOf(first(sp.product), DATA_REQUEST_PRODUCTS),
    q: first(sp.q).slice(0, 320),
    sort: first(sp.sort) === "requested" ? "requested" : "due",
    cursor: first(sp.cursor).slice(0, 512),
    trail: parseTrail(first(sp.trail)),
  };
}

/** Whether a search or filter narrows the list (the view tab alone does not). */
export function hasDataRequestsFilters(filters: DataRequestsFilters): boolean {
  return Boolean(filters.q || filters.status || filters.kind || filters.product);
}

/** What the Bid API's list route takes for these filters. */
export function dataRequestsApiQuery(filters: DataRequestsFilters): URLSearchParams {
  const query = new URLSearchParams({ view: filters.view, sort: filters.sort });
  if (filters.status) query.set("status", filters.status);
  if (filters.kind) query.set("kind", filters.kind);
  if (filters.product) query.set("product", filters.product);
  if (filters.q) query.set("q", filters.q);
  if (filters.cursor) query.set("cursor", filters.cursor);
  return query;
}

type Patch = Record<string, string | number | null | undefined>;

/** The list URL with `patch` applied; any filter change returns to the first page. */
export function dataRequestsHref(current: DataRequestsSearch, patch: Patch): string {
  const next: Patch = { cursor: null, trail: null, ...patch };
  // The default view and order keep the URL clean.
  if (next.view === DEFAULT_DATA_REQUESTS_VIEW) next.view = null;
  if (next.sort === "due") next.sort = null;
  return buildListHref(DATA_REQUESTS_PATH, current, next);
}

/** A request's page. It carries the list's state, so J and K step through the same list. */
export function dataRequestHref(reference: string, list: DataRequestsFilters | null): string {
  const base = `${DATA_REQUESTS_PATH}/${encodeURIComponent(reference)}`;
  if (!list) return base;
  const query = dataRequestsApiQuery(list);
  if (list.trail.length > 0) query.set("trail", JSON.stringify(list.trail));
  return `${base}?${query.toString()}`;
}

/** The list a record was opened from, as the URL's own search. */
export function listSearchFromRecordSearch(sp: DataRequestsSearch): DataRequestsFilters | null {
  return typeof sp.view === "string" ? parseDataRequestsSearch(sp) : null;
}

/** The list URL for a filter state, for the breadcrumb on a record page. */
export function dataRequestsListHref(filters: DataRequestsFilters): string {
  return dataRequestsHref(
    {},
    {
      view: filters.view,
      sort: filters.sort,
      status: filters.status,
      kind: filters.kind,
      product: filters.product,
      q: filters.q,
      cursor: filters.cursor,
      trail: filters.trail.length > 0 ? JSON.stringify(filters.trail) : null,
    },
  );
}

export type DataRequestsFilterChip = { id: string; label: string; clearHref: string };

type ChipLabels = {
  status: (value: string) => string;
  kind: (value: string) => string;
  product: (value: string) => string;
};

/** One removable chip per filter that is on, worded as the filter reads in the toolbar. */
export function buildDataRequestsChips(
  filters: DataRequestsFilters,
  current: DataRequestsSearch,
  labels: ChipLabels,
): DataRequestsFilterChip[] {
  const chips: DataRequestsFilterChip[] = [];
  if (filters.q) {
    chips.push({
      id: "q",
      label: searchChipLabel(filters.q),
      clearHref: dataRequestsHref(current, { q: null }),
    });
  }
  if (filters.status) {
    chips.push({
      id: "status",
      label: `Status: ${labels.status(filters.status)}`,
      clearHref: dataRequestsHref(current, { status: null }),
    });
  }
  if (filters.kind) {
    chips.push({
      id: "kind",
      label: `Kind: ${labels.kind(filters.kind)}`,
      clearHref: dataRequestsHref(current, { kind: null }),
    });
  }
  if (filters.product) {
    chips.push({
      id: "product",
      label: `Product: ${labels.product(filters.product)}`,
      clearHref: dataRequestsHref(current, { product: null }),
    });
  }
  return chips;
}
