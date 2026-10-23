import { type CurrencyTotal, sumByCurrency } from "./currency-totals.js";
import type { LaxPortfolioItemStatus, LaxPortfolioItemV1 } from "./lax-portfolio-contract.v1.js";
import { costBasisLines } from "./portfolio-header.vm.js";
import type { LaxProductId } from "./product-directory.js";

export type HoldingsSort = "acquired_desc" | "acquired_asc" | "title_asc";

export type HoldingsFilter = {
  statuses?: readonly LaxPortfolioItemStatus[];
  products?: readonly LaxProductId[];
  artist?: string;
  /** Four-digit year of acquisition, in UTC. */
  year?: number;
  /** Matches works with at least one cost line in this currency. */
  currency?: string;
  /** Free text matched, ignoring case, against a work's title and artist. */
  search?: string;
};

export type HoldingRowVm = {
  key: string;
  item: LaxPortfolioItemV1;
  /** Cost basis per currency; empty when the product recorded no cost lines. */
  paid: CurrencyTotal[];
  documentsAvailable: number;
  documentsExpected: number;
};

export type AllocationCount = { label: string; count: number };

export type HoldingsVm = {
  rows: HoldingRowVm[];
  /** Counts by artist and product across the filtered works, never percentages of value. */
  allocation: { byArtist: AllocationCount[]; byProduct: AllocationCount[] };
  /** True when filters hid every work although the portfolio is not empty. */
  noResults: boolean;
};

export const UNKNOWN_ARTIST_LABEL = "Unknown artist";

function matches(item: LaxPortfolioItemV1, filter: HoldingsFilter): boolean {
  if (filter.search) {
    const needle = filter.search.trim().toLocaleLowerCase();
    const haystack = `${item.title} ${item.artist}`.toLocaleLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  if (filter.statuses?.length && !filter.statuses.includes(item.status)) return false;
  if (filter.products?.length && !filter.products.includes(item.product)) return false;
  if (filter.artist && item.artist.trim() !== filter.artist) return false;
  if (filter.year !== undefined && new Date(item.acquiredAt).getUTCFullYear() !== filter.year) {
    return false;
  }
  if (filter.currency && !item.paid.lines.some((line) => line.currency === filter.currency)) {
    return false;
  }
  return true;
}

function compare(sort: HoldingsSort) {
  return (a: LaxPortfolioItemV1, b: LaxPortfolioItemV1): number => {
    const byDate = Date.parse(a.acquiredAt) - Date.parse(b.acquiredAt);
    if (sort === "title_asc") return a.title.localeCompare(b.title) || byDate;
    return sort === "acquired_asc" ? byDate : -byDate;
  };
}

function countBy(labels: string[]): AllocationCount[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildHoldings(
  items: readonly LaxPortfolioItemV1[],
  filter: HoldingsFilter = {},
  sort: HoldingsSort = "acquired_desc",
): HoldingsVm {
  const visible = items.filter((item) => matches(item, filter)).sort(compare(sort));
  return {
    rows: visible.map((item) => ({
      key: `${item.product}:${item.id}`,
      item,
      paid: sumByCurrency(costBasisLines(item)),
      documentsAvailable: item.documents.filter((doc) => doc.available).length,
      documentsExpected: item.documents.filter((doc) => !doc.available).length,
    })),
    allocation: {
      byArtist: countBy(visible.map((item) => item.artist.trim() || UNKNOWN_ARTIST_LABEL)),
      byProduct: countBy(visible.map((item) => item.product)),
    },
    noResults: visible.length === 0 && items.length > 0,
  };
}

/** The values a filter control can offer, derived from the works that exist. */
export function holdingsFilterOptions(items: readonly LaxPortfolioItemV1[]) {
  const unique = <T>(values: T[]) => [...new Set(values)];
  return {
    artists: unique(items.map((item) => item.artist.trim()).filter(Boolean)).sort((a, b) =>
      a.localeCompare(b),
    ),
    years: unique(items.map((item) => new Date(item.acquiredAt).getUTCFullYear())).sort(
      (a, b) => b - a,
    ),
    currencies: unique(
      items.flatMap((item) => item.paid.lines.map((line) => line.currency)),
    ).sort(),
  };
}

export type PortfolioEmptyState = "new_collector" | "only_awaiting_payment" | "no_documents";

/**
 * Which empty-state copy the overview should lead with, or null when there is nothing to
 * explain. A collector with no works is welcomed; one whose only works are unpaid is led to
 * pay; one with works but no documents yet is told which are expected.
 */
export function portfolioEmptyState(
  items: readonly LaxPortfolioItemV1[],
): PortfolioEmptyState | null {
  if (items.length === 0) return "new_collector";
  if (items.every((item) => item.status === "awaiting_payment")) return "only_awaiting_payment";
  if (items.every((item) => !item.documents.some((doc) => doc.available))) return "no_documents";
  return null;
}
