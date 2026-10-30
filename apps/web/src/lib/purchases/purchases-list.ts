import { matchesEveryWord, searchParam } from "@/lib/workspace/list-search";
import { PURCHASE_TABS, PURCHASE_TAB_LABEL, type PurchaseTab } from "./purchase-progress";
import type { PurchaseCardVm } from "./purchases.vm";

export { PURCHASE_TABS, PURCHASE_TAB_LABEL };

export const PURCHASE_SORTS = ["due", "recent"] as const;
export type PurchaseSort = (typeof PURCHASE_SORTS)[number];

export const PURCHASE_SORT_LABEL: Record<PurchaseSort, string> = {
  due: "Due date",
  recent: "Most recent",
};

/** What the list shows, as it is written in the address so a view can be shared. */
export type PurchasesListQuery = {
  view: PurchaseTab;
  q: string;
  sale: string | null;
  wonBy: string | null;
  sort: PurchaseSort;
};

/** Money owed reads soonest due first; the rest most recent first. */
export function defaultPurchaseSort(view: PurchaseTab): PurchaseSort {
  return view === "to-pay" ? "due" : "recent";
}

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | null {
  return raw && (values as readonly string[]).includes(raw) ? (raw as T) : null;
}

/** `fallbackView` is the view to open when the address names none (the first with anything). */
export function parsePurchasesListQuery(
  params: Readonly<Record<string, string | string[] | undefined>>,
  fallbackView: PurchaseTab = "to-pay",
): PurchasesListQuery {
  const view = oneOf(PURCHASE_TABS, searchParam(params.tab)) ?? fallbackView;
  return {
    view,
    q: searchParam(params.q) ?? "",
    sale: searchParam(params.sale),
    wonBy: searchParam(params.wonBy),
    sort: oneOf(PURCHASE_SORTS, searchParam(params.sort)) ?? defaultPurchaseSort(view),
  };
}

/** The address of a list query; the view is always written, the defaults are left out. */
export function purchasesListSearch(query: PurchasesListQuery): string {
  const params = new URLSearchParams({ tab: query.view });
  if (query.q) params.set("q", query.q);
  if (query.sale) params.set("sale", query.sale);
  if (query.wonBy) params.set("wonBy", query.wonBy);
  if (query.sort !== defaultPurchaseSort(query.view)) params.set("sort", query.sort);
  return `?${params.toString()}`;
}

export function purchaseMatches(card: PurchaseCardVm, query: PurchasesListQuery): boolean {
  if (query.sale && card.saleId !== query.sale) return false;
  if (query.wonBy && card.wonBy !== query.wonBy) return false;
  return matchesEveryWord(
    [card.title, card.lotLabel, card.lotLabel?.replace(/^Lot /, ""), card.saleTitle, card.wonBy],
    query.q,
  );
}

const SORTERS: Record<PurchaseSort, (a: PurchaseCardVm, b: PurchaseCardVm) => number> = {
  due: (a, b) => a.dueAt - b.dueAt,
  recent: (a, b) => b.wonAt - a.wonAt,
};

export function purchasesInView(
  cards: readonly PurchaseCardVm[],
  query: PurchasesListQuery,
): PurchaseCardVm[] {
  return cards.filter((card) => purchaseMatches(card, query)).sort(SORTERS[query.sort]);
}

export function purchaseViewCounts(
  cardsByTab: Readonly<Record<PurchaseTab, readonly PurchaseCardVm[]>>,
  query: PurchasesListQuery,
): Record<PurchaseTab, number> {
  const count = (tab: PurchaseTab) =>
    cardsByTab[tab].filter((card) => purchaseMatches(card, query)).length;
  return {
    "to-pay": count("to-pay"),
    "in-progress": count("in-progress"),
    completed: count("completed"),
  };
}

export type PurchaseFilterKey = "sale" | "wonBy";

export function appliedPurchaseFilters(
  query: PurchasesListQuery,
  sales: readonly { id: string; title: string }[],
): { id: PurchaseFilterKey; label: string }[] {
  const chips: { id: PurchaseFilterKey; label: string }[] = [];
  if (query.sale) {
    chips.push({
      id: "sale",
      label: `Sale: ${sales.find((sale) => sale.id === query.sale)?.title ?? "One sale"}`,
    });
  }
  if (query.wonBy) chips.push({ id: "wonBy", label: `Won by: ${query.wonBy}` });
  return chips;
}

export function isPurchaseListNarrowed(query: PurchasesListQuery): boolean {
  return Boolean(query.q || query.sale || query.wonBy);
}
