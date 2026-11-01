import {
  CONSIGNMENT_INBOX_SORTS,
  CONSIGNMENT_INBOX_VIEWS,
  type ConsignmentInboxSort,
  type ConsignmentInboxView,
  defaultConsignmentInboxSort,
} from "@auction/domain";
import type { ConsignmentInboxFacet, ConsignmentInboxSummary } from "@auction/validators";

/**
 * The inbox list's state, all of it in the URL: view, search, the three filters, sort and page.
 * The same query string goes to the API, follows a thread page (so its pager and breadcrumb know
 * the list it came from) and comes back with "Back to the list".
 */

export const INBOX_PATH = "/admin/inbox";
export const SAVED_REPLIES_PATH = "/admin/inbox/saved-replies";
export const INBOX_PAGE_SIZE = 50;

export type InboxSearchParams = Record<string, string | string[] | undefined>;

export type InboxListState = {
  view: ConsignmentInboxView;
  q: string;
  specialist: string[];
  sale: string[];
  organisation: string[];
  /** Null means the view's default order. */
  sort: ConsignmentInboxSort | null;
  offset: number;
  limit: number;
};

export type InboxFilterKey = "specialist" | "sale" | "organisation";

export const INBOX_VIEW_LABELS: Record<ConsignmentInboxView, string> = {
  unanswered: "Unanswered",
  mine: "Assigned to me",
  all: "All",
  closed: "Closed",
};

export const INBOX_SORT_OPTIONS: ReadonlyArray<{ value: ConsignmentInboxSort; label: string }> = [
  { value: "waiting", label: "Longest waiting" },
  { value: "latest", label: "Latest activity" },
  { value: "oldest", label: "Oldest activity" },
  { value: "sale_date", label: "Sale date" },
];

export const INBOX_FILTER_LABELS: Record<InboxFilterKey, string> = {
  specialist: "Specialist",
  sale: "Sale",
  organisation: "Organisation",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function list(value: string | string[] | undefined): string[] {
  const raw = first(value);
  return raw
    ? [
        ...new Set(
          raw
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

function oneOf<T extends string>(values: readonly T[], raw: string | undefined): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

export function parseInboxListState(sp: InboxSearchParams): InboxListState {
  const offset = Number.parseInt(first(sp.offset) ?? "0", 10);
  return {
    view: oneOf(CONSIGNMENT_INBOX_VIEWS, first(sp.view)) ?? "unanswered",
    q: (first(sp.q) ?? "").trim().slice(0, 200),
    specialist: list(sp.specialist),
    sale: list(sp.sale),
    organisation: list(sp.organisation),
    sort: oneOf(CONSIGNMENT_INBOX_SORTS, first(sp.sort)),
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    limit: INBOX_PAGE_SIZE,
  };
}

/** The order in force: the chosen one, or the view's default. */
export function inboxSort(state: InboxListState): ConsignmentInboxSort {
  return state.sort ?? defaultConsignmentInboxSort(state.view);
}

/** The state as a query string, leaving out defaults so links stay short. */
export function inboxQuery(state: InboxListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== "unanswered") params.set("view", state.view);
  if (state.q) params.set("q", state.q);
  for (const key of ["specialist", "sale", "organisation"] as const) {
    if (state[key].length > 0) params.set(key, state[key].join(","));
  }
  if (state.sort && state.sort !== defaultConsignmentInboxSort(state.view)) {
    params.set("sort", state.sort);
  }
  if (state.offset > 0) params.set("offset", String(state.offset));
  return params;
}

/** What the API reads: the URL state plus the page size, and the view always named. */
export function inboxApiQuery(state: InboxListState): URLSearchParams {
  const params = inboxQuery(state);
  params.set("view", state.view);
  params.set("limit", String(state.limit));
  return params;
}

/**
 * The list with something changed. Changing the view, search, a filter or the sort starts again
 * at the first page; a view change also drops a sort that was only that view's default.
 */
export function inboxHref(state: InboxListState, change: Partial<InboxListState> = {}): string {
  const resetsPage = Object.keys(change).some((key) => key !== "offset");
  const next: InboxListState = {
    ...state,
    ...change,
    ...(resetsPage && change.offset === undefined ? { offset: 0 } : {}),
    ...(change.view && change.view !== state.view && change.sort === undefined
      ? { sort: null }
      : {}),
  };
  const query = inboxQuery(next).toString();
  return query ? `${INBOX_PATH}?${query}` : INBOX_PATH;
}

/** A thread opened from the list, carrying the list so the pager and breadcrumb follow it. */
export function inboxThreadHref(submissionId: string, state: InboxListState | null): string {
  const base = `${INBOX_PATH}/${encodeURIComponent(submissionId)}`;
  if (!state) return base;
  const query = inboxQuery(state);
  query.set("view", state.view);
  return `${base}?${query.toString()}`;
}

/** Whether search or any filter narrows the list (picks "no results" over "empty"). */
export function inboxFiltered(state: InboxListState): boolean {
  return Boolean(
    state.q || state.specialist.length || state.sale.length || state.organisation.length,
  );
}

/** The view tabs, with counts on the two that need action. */
export function inboxViews(state: InboxListState, summary: ConsignmentInboxSummary | null) {
  const counts: Partial<Record<ConsignmentInboxView, number>> = summary
    ? { unanswered: summary.unanswered, mine: summary.mine.waiting }
    : {};
  return CONSIGNMENT_INBOX_VIEWS.map((view) => ({
    id: view,
    label: INBOX_VIEW_LABELS[view],
    href: inboxHref({ ...state, sort: null }, { view }),
    ...(counts[view] ? { count: counts[view] } : {}),
  }));
}

/** The filters in force as chips: "Sale: Modern British & Irish Art". */
export function inboxFilterChips(
  state: InboxListState,
  facets: Record<InboxFilterKey, readonly ConsignmentInboxFacet[]>,
): Array<{ id: string; label: string; href: string }> {
  const chips: Array<{ id: string; label: string; href: string }> = [];
  if (state.q) {
    chips.push({ id: "q", label: `Search: “${state.q}”`, href: inboxHref(state, { q: "" }) });
  }
  for (const key of ["specialist", "sale", "organisation"] as const) {
    for (const id of state[key]) {
      const label = facets[key].find((facet) => facet.id === id)?.label ?? "Unknown";
      chips.push({
        id: `${key}:${id}`,
        label: `${INBOX_FILTER_LABELS[key]}: ${label}`,
        href: inboxHref(state, { [key]: state[key].filter((value) => value !== id) }),
      });
    }
  }
  return chips;
}

/** Every filter and the search cleared, view and sort kept. */
export function inboxClearedHref(state: InboxListState): string {
  return inboxHref(state, { q: "", specialist: [], sale: [], organisation: [] });
}

/** "1–6 of 12". */
export function inboxRangeSummary(offset: number, shown: number, total: number): string {
  if (total === 0 || shown === 0) return "0 threads";
  return `${offset + 1}–${offset + shown} of ${total.toLocaleString("en-GB")}`;
}
