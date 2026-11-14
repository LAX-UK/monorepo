import { type ListStateOptions, listStateQuery, parseListState } from "@auction/staff-ui";
import {
  WATCHED_LOT_SORTS,
  type WatchedLotSort,
  type WatchingView,
  parseWatchingView,
} from "./watching.vm";

/** What the Watching page shows: the view, the search words and, on lots, the order. */
export type WatchingListQuery = { view: WatchingView; q: string; sort: WatchedLotSort };

const OPTIONS: ListStateOptions = {
  sortable: WATCHED_LOT_SORTS,
  defaultSort: { columnId: "closing", direction: "asc" },
};

type SearchInput = Record<string, string | string[] | undefined>;

/**
 * The query from the address: `?tab=` the view (as before), then `q` and `sort` as every other
 * list reads them. `section=artists` is the old address of the artists view.
 */
export function parseWatchingListQuery(sp: SearchInput): WatchingListQuery {
  const state = parseListState(sp, OPTIONS);
  return {
    view: parseWatchingView(sp.tab ?? (sp.section === "artists" ? "artists" : undefined)),
    q: state.search ?? "",
    sort: (state.sort?.columnId ?? "closing") as WatchedLotSort,
  };
}

/** The address of a query, defaults left out so the plain list stays `/watching`. */
export function watchingListSearch(query: WatchingListQuery): string {
  const params = new URLSearchParams(
    listStateQuery(
      {
        search: query.q,
        // Only lots can be ordered.
        sort: query.view === "lots" ? { columnId: query.sort, direction: "asc" } : null,
      },
      OPTIONS,
    ),
  );
  const rest = params.toString();
  const search = [query.view === "lots" ? "" : `tab=${query.view}`, rest].filter(Boolean).join("&");
  return search ? `?${search}` : "";
}
