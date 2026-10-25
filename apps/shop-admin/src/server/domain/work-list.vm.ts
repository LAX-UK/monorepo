import { STAFF_DEFAULT_PAGE_SIZE, parseStaffPageSize } from "@auction/staff-ui";
import { type RawSearchParams, listHref, oneOf, singleParam } from "./list-url-state";

/*
 * The URL state of a sales or operations work list: the view, a search, the list's own
 * filters, a sort, the page and the record open in the panel. Every list keeps all of it in the
 * URL, so a view, a filtered list or an open record can be shared and reloaded. Pure, so the
 * rules are tested without rendering.
 */

export type SortDirection = "asc" | "desc";
export type ListSort = { columnId: string; direction: SortDirection };

export type WorkListView = {
  id: string;
  label: string;
  /** What the view asks the API for, e.g. `{ status: "due" }`; empty for everything. */
  api: Record<string, string>;
  /** The status counts that add up to this view; none counts every status. */
  statuses?: readonly string[];
};

export type WorkListState<F extends string = string> = {
  /** The view's id; the list's default view when the URL names none. */
  view: string;
  q?: string;
  /** The API sort key, e.g. "created_desc"; absent for the default. */
  sort?: string;
  cursor?: string;
  /** Rows per page, absent for the default of 50. */
  limit?: string;
  filters: Partial<Record<F, string>>;
  /** The record open in the panel. */
  open?: string;
};

export type WorkListConfig<F extends string> = {
  path: string;
  views: readonly WorkListView[];
  /** The view a bare URL shows. */
  defaultView: string;
  /** Each filter and the values it accepts. */
  filters: Record<F, readonly string[]>;
  /** Each sortable column and its API keys; `defaultSort` is the key a bare URL sorts by. */
  sorts: Record<string, { asc: string; desc: string }>;
  defaultSort: string;
  /** The search param naming the record open in the panel, e.g. "payout". */
  panelParam: string;
  searchMaxLength: number;
};

export type WorkList<F extends string> = ReturnType<typeof defineWorkList<F>>;

/**
 * One list's URL rules. Changing the view, search, a filter, the sort or the page size returns to
 * the first page and closes the panel, because a cursor only means something under the query it
 * was issued for. A `null` in a change clears that part.
 */
export function defineWorkList<F extends string>(config: WorkListConfig<F>) {
  const viewIds = config.views.map((view) => view.id);
  const sortKeys = Object.values(config.sorts).flatMap((keys) => [keys.asc, keys.desc]);
  const filterIds = Object.keys(config.filters) as F[];

  function sortState(key: string | undefined): ListSort {
    const value = key ?? config.defaultSort;
    for (const [columnId, keys] of Object.entries(config.sorts)) {
      if (keys.asc === value) return { columnId, direction: "asc" };
      if (keys.desc === value) return { columnId, direction: "desc" };
    }
    return sortState(config.defaultSort);
  }

  function parse(params: RawSearchParams): WorkListState<F> {
    const view = oneOf(singleParam(params.view), viewIds) ?? config.defaultView;
    const q = singleParam(params.q)?.slice(0, config.searchMaxLength);
    const sort = oneOf(singleParam(params.sort), sortKeys);
    const cursor = singleParam(params.cursor);
    const limit = parseStaffPageSize(singleParam(params.limit));
    const open = singleParam(params[config.panelParam]);
    const filters: Partial<Record<F, string>> = {};
    for (const id of filterIds) {
      const value = oneOf(singleParam(params[id]), config.filters[id]);
      if (value) filters[id] = value;
    }
    return {
      view,
      ...(q ? { q } : {}),
      ...(sort && sort !== config.defaultSort ? { sort } : {}),
      ...(cursor ? { cursor } : {}),
      ...(limit !== STAFF_DEFAULT_PAGE_SIZE ? { limit: String(limit) } : {}),
      filters,
      ...(open ? { open } : {}),
    };
  }

  function params(state: WorkListState<F>): Record<string, string | undefined> {
    return {
      view: state.view === config.defaultView ? undefined : state.view,
      q: state.q,
      ...state.filters,
      sort: state.sort,
      limit: state.limit,
      cursor: state.cursor,
      [config.panelParam]: state.open,
    };
  }

  type Change = {
    view?: string | null;
    q?: string | null;
    sort?: string | null;
    limit?: string | null;
  } & { [K in F]?: string | null };

  function href(state: WorkListState<F>, change: Change = {}): string {
    const next = { ...params(state), cursor: undefined, [config.panelParam]: undefined };
    for (const [key, value] of Object.entries(change)) {
      next[key] = (value as string | null | undefined) ?? undefined;
    }
    if (next.view === config.defaultView) next.view = undefined;
    if (next.sort === config.defaultSort) next.sort = undefined;
    return listHref(config.path, next);
  }

  return {
    config,
    parse,
    href,
    /** The same list one page on. */
    pageHref(state: WorkListState<F>, cursor: string): string {
      return listHref(config.path, { ...params(state), cursor, [config.panelParam]: undefined });
    },
    /** The same list and page with this record's panel open, or closed for null. */
    panelHref(state: WorkListState<F>, id: string | null): string {
      return listHref(config.path, { ...params(state), [config.panelParam]: id ?? undefined });
    },
    /** What the list API is asked for. */
    apiQuery(state: WorkListState<F>): Record<string, string> {
      const view = config.views.find((candidate) => candidate.id === state.view);
      const query: Record<string, string | undefined> = {
        ...view?.api,
        q: state.q,
        ...state.filters,
        sort: state.sort,
        limit: state.limit,
      };
      return Object.fromEntries(
        Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
      );
    },
    sortState(state: WorkListState<F>): ListSort {
      return sortState(state.sort);
    },
    /** The sort a bare URL shows. */
    defaultSortState(): ListSort {
      return sortState(config.defaultSort);
    },
    /** The `sort` value for a header click; null for the default. */
    sortParam(sort: ListSort | null): string | null {
      if (!sort) return null;
      const key = config.sorts[sort.columnId]?.[sort.direction];
      return key && key !== config.defaultSort ? key : null;
    },
    /** A search or filter narrows the list; the view and paging do not count. */
    filtered(state: WorkListState<F>): boolean {
      return Boolean(state.q) || filterIds.some((id) => Boolean(state.filters[id]));
    },
    /** Each view with its count, summed from the per-status counts. */
    views(state: WorkListState<F>, counts: Readonly<Record<string, number>> | undefined) {
      return config.views.map((view) => ({
        id: view.id,
        label: view.label,
        href: href(state, { view: view.id }),
        count: Object.entries(counts ?? {})
          .filter(([status]) => !view.statuses || view.statuses.includes(status))
          .reduce((sum, [, value]) => sum + value, 0),
      }));
    },
    pageSize(state: WorkListState<F>): number {
      return state.limit ? Number(state.limit) : STAFF_DEFAULT_PAGE_SIZE;
    },
  };
}

/** A view per status, labelled by `label`, after an optional lead view. */
export function statusViews(
  statuses: readonly string[],
  label: (status: string) => string,
): WorkListView[] {
  return statuses.map((status) => ({
    id: status,
    label: label(status),
    api: { status },
    statuses: [status],
  }));
}

/** "12 payouts on this page", for the pagination summary. */
export function pageSummary(count: number, noun: { one: string; other: string }): string {
  return `${count} ${count === 1 ? noun.one : noun.other} on this page`;
}
