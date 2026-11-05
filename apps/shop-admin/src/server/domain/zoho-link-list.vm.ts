import type {
  AdminZohoLinkReport,
  AdminZohoLinkRow,
  AdminZohoLinkedRow,
} from "@auction/shop-contracts";
import {
  ZOHO_LINK_VIEWS,
  type ZohoLinkRule,
  type ZohoLinkView,
  type ZohoQueueQuery,
} from "./zoho-register.vm";

/*
 * The Link lax.art report as a list: which part of the report is shown, the filters and order in
 * the URL, and the page of rows. The report is read whole (a few hundred rows at most), so this
 * narrows and pages it in memory; the URL stays the state, as on every other list.
 */

export const LINK_PAGE_SIZE = 50;

export const LINK_VIEW_LABEL: Record<ZohoLinkView, string> = {
  matched: "Matched",
  choice: "Needs a choice",
  none: "No match",
  linked: "Linked",
};

/** What each rule matched on, as the chips of the "Matched on" column. */
export const LINK_RULE_CHIPS: Record<ZohoLinkRule, readonly string[]> = {
  stock_code: ["Stock code"],
  artist_and_title: ["Artist and title"],
  artist_title_and_size: ["Artist and title", "Size"],
  artist_title_and_year: ["Artist and title", "Year"],
};

/** The rules offered by the "Matched on" filter, strongest first. */
export const LINK_RULE_FILTER_OPTIONS: ReadonlyArray<{ value: ZohoLinkRule; label: string }> = [
  { value: "stock_code", label: "Stock code" },
  { value: "artist_and_title", label: "Artist and title" },
  { value: "artist_title_and_size", label: "Artist, title and size" },
  { value: "artist_title_and_year", label: "Artist, title and year" },
];

export const LINK_ON_FILTER_OPTIONS = [
  { value: "live", label: "Live on lax.art" },
  { value: "draft", label: "Draft" },
] as const;

export const LINK_SORT_OPTIONS = [
  { value: "title", label: "Title" },
  { value: "artist", label: "Artist" },
] as const;

export function activeLinkView(query: ZohoQueueQuery): ZohoLinkView {
  return query.view ?? "matched";
}

export function hasActiveLinkFilters(query: ZohoQueueQuery): boolean {
  return Boolean(query.q || query.artist || query.matched || query.on);
}

const norm = (value: string) => value.normalize("NFKD").toLowerCase();

type Listing = AdminZohoLinkRow["listing"] | AdminZohoLinkedRow["listing"];

function listingMatchesFilters(
  listing: Listing,
  codes: readonly string[],
  query: ZohoQueueQuery,
): boolean {
  if (query.artist && listing.artistName !== query.artist) return false;
  if (query.on && listing.published !== (query.on === "live")) return false;
  if (query.q) {
    const haystack = norm([listing.title, listing.artistName, ...codes].join(" "));
    if (!query.q.split(/\s+/).every((word) => haystack.includes(norm(word)))) return false;
  }
  return true;
}

const rowCodes = (row: AdminZohoLinkRow) => [
  ...(row.listing.stockCode ? [row.listing.stockCode] : []),
  ...row.candidates.flatMap((candidate) => [candidate.record.stockCode, candidate.record.title]),
];

/** The rows of one part of the report, narrowed by the URL's filters and put in order. */
export function narrowRows(
  rows: readonly AdminZohoLinkRow[],
  query: ZohoQueueQuery,
): AdminZohoLinkRow[] {
  return orderBy(
    rows.filter(
      (row) =>
        (!query.matched || row.rule === query.matched) &&
        listingMatchesFilters(row.listing, rowCodes(row), query),
    ),
    (row) => row.listing,
    query,
  );
}

export function narrowLinked(
  rows: readonly AdminZohoLinkedRow[],
  query: ZohoQueueQuery,
): AdminZohoLinkedRow[] {
  return orderBy(
    rows.filter((row) =>
      listingMatchesFilters(row.listing, [row.record.stockCode, row.record.title], query),
    ),
    (row) => row.listing,
    query,
  );
}

function orderBy<T>(
  rows: readonly T[],
  listingOf: (row: T) => Listing,
  query: ZohoQueueQuery,
): T[] {
  const collator = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });
  const key = query.sort === "artist" ? "artistName" : "title";
  return [...rows].sort((a, b) => {
    const first = listingOf(a);
    const second = listingOf(b);
    const byKey = collator.compare(first[key], second[key]);
    return byKey !== 0 ? byKey : collator.compare(first.title, second.title);
  });
}

/** The page of `rows` the URL asks for, with the totals the footer needs. */
export function pageOf<T>(rows: readonly T[], query: ZohoQueueQuery) {
  const page = Math.max(1, Number(query.page ?? "1") || 1);
  const lastPage = Math.max(1, Math.ceil(rows.length / LINK_PAGE_SIZE));
  const current = Math.min(page, lastPage);
  return {
    items: rows.slice((current - 1) * LINK_PAGE_SIZE, current * LINK_PAGE_SIZE),
    page: current,
    pageSize: LINK_PAGE_SIZE,
    total: rows.length,
  };
}

/** The artists in a part of the report, for the Artist filter. */
export function artistOptions(listings: readonly Listing[]) {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    counts.set(listing.artistName, (counts.get(listing.artistName) ?? 0) + 1);
  }
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b, "en-GB"))
    .map(([name, count]) => ({ value: name, label: `${name} (${count})` }));
}

/** How many rows each part of the report holds, in the order the control shows them. */
export function linkViewCounts(report: AdminZohoLinkReport): Record<ZohoLinkView, number> {
  return {
    matched: report.counts.matched,
    choice: report.counts.needsChoice,
    none: report.counts.noMatch,
    linked: report.counts.linked,
  };
}

export const LINK_VIEWS = ZOHO_LINK_VIEWS;
