import { matchesEveryWord, searchParam } from "@/lib/workspace/list-search";
import type { MyBidStatus, MyBidTab } from "./my-bid-status";
import { MY_BID_STATUS_LABEL, type MyBidCardVm, type MyBidSale } from "./my-bids.vm";

/** The views of Bids: the three bid views, then the sales the account is registered for. */
export const BIDS_VIEWS = ["active", "won", "lost", "sales"] as const;
export type BidsView = (typeof BIDS_VIEWS)[number];

export const BIDS_VIEW_LABEL: Record<BidsView, string> = {
  active: "Active",
  won: "Won",
  lost: "Not won",
  sales: "Sales",
};

export const BIDS_SORTS = ["closing", "recent", "highest"] as const;
export type BidsSort = (typeof BIDS_SORTS)[number];

export const BIDS_SORT_LABEL: Record<BidsSort, string> = {
  closing: "Closing soonest",
  recent: "Most recent",
  highest: "Highest bid",
};

/** What the list shows, as it is written in the address so a view can be shared. */
export type BidsListQuery = {
  view: BidsView;
  q: string;
  sale: string | null;
  by: string | null;
  status: MyBidStatus | null;
  sort: BidsSort;
};

/** Open lots read soonest first; closed ones most recent first. */
export function defaultBidsSort(view: BidsView): BidsSort {
  return view === "active" ? "closing" : "recent";
}

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

const STATUSES = Object.keys(MY_BID_STATUS_LABEL) as MyBidStatus[];

export function parseBidsListQuery(
  params: Readonly<Record<string, string | string[] | undefined>>,
): BidsListQuery {
  const view = oneOf(BIDS_VIEWS, searchParam(params.tab)) ?? "active";
  return {
    view,
    q: searchParam(params.q) ?? "",
    sale: searchParam(params.sale),
    by: searchParam(params.by),
    status: oneOf(STATUSES, searchParam(params.status)),
    sort: oneOf(BIDS_SORTS, searchParam(params.sort)) ?? defaultBidsSort(view),
  };
}

/** The address of a list query; defaults are left out so a plain view stays `/bids`. */
export function bidsListSearch(query: BidsListQuery): string {
  const params = new URLSearchParams();
  if (query.view !== "active") params.set("tab", query.view);
  if (query.q) params.set("q", query.q);
  if (query.sale) params.set("sale", query.sale);
  if (query.by) params.set("by", query.by);
  if (query.status) params.set("status", query.status);
  if (query.sort !== defaultBidsSort(query.view)) params.set("sort", query.sort);
  const search = params.toString();
  return search ? `?${search}` : "";
}

/** Whether a bid row passes the filters and the search, whatever the view. */
export function bidMatches(card: MyBidCardVm, query: BidsListQuery): boolean {
  if (query.sale && card.saleId !== query.sale) return false;
  if (query.by && card.placedBy !== query.by) return false;
  if (query.status && card.status !== query.status) return false;
  return matchesEveryWord(
    [card.title, card.lotLabel, card.lotLabel?.replace(/^Lot /, ""), card.saleTitle, card.placedBy],
    query.q,
  );
}

const SORTERS: Record<BidsSort, (a: MyBidCardVm, b: MyBidCardVm) => number> = {
  closing: (a, b) => a.closesAt - b.closesAt,
  recent: (a, b) => b.closesAt - a.closesAt,
  highest: (a, b) => b.amount - a.amount,
};

/** One bid view after the filters, the search and the order. */
export function bidsInView(cards: readonly MyBidCardVm[], query: BidsListQuery): MyBidCardVm[] {
  return cards.filter((card) => bidMatches(card, query)).sort(SORTERS[query.sort]);
}

/** How many rows each bid view holds under the current filters and search. */
export function bidViewCounts(
  cardsByTab: Readonly<Record<MyBidTab, readonly MyBidCardVm[]>>,
  query: BidsListQuery,
): Record<MyBidTab, number> {
  const count = (tab: MyBidTab) => cardsByTab[tab].filter((card) => bidMatches(card, query)).length;
  return { active: count("active"), won: count("won"), lost: count("lost") };
}

export type BidFilterKey = "sale" | "by" | "status";

/** The applied filters, as chips: "Sale: Autumn online", "Placed by: Tom Whitfield". */
export function appliedBidFilters(
  query: BidsListQuery,
  sales: readonly MyBidSale[],
): { id: BidFilterKey; label: string }[] {
  const chips: { id: BidFilterKey; label: string }[] = [];
  if (query.sale) {
    const title = sales.find((sale) => sale.id === query.sale)?.title ?? "One sale";
    chips.push({ id: "sale", label: `Sale: ${title}` });
  }
  if (query.by) chips.push({ id: "by", label: `Placed by: ${query.by}` });
  if (query.status)
    chips.push({ id: "status", label: `Status: ${MY_BID_STATUS_LABEL[query.status]}` });
  return chips;
}

/** Whether the search or a filter is narrowing the list. */
export function isNarrowed(query: BidsListQuery): boolean {
  return Boolean(query.q || query.sale || query.by || query.status);
}
