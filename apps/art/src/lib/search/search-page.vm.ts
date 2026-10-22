import { artistHref } from "@/lib/catalogue/catalogue-artwork-card.vm";
import {
  SEARCH_TABS,
  type SearchTab,
  type SearchUrlState,
  searchFilterHref,
} from "@/lib/search/search-params";
import type { PublicArtistSummary } from "@auction/shop-contracts";

/**
 * Per-tab result count: a number when known, `null` when the read failed or the API did not
 * report a total, and `hidden` when the source is switched off (editorial disabled).
 */
export type SearchTabCount = number | null | "hidden";

export type SearchTabCounts = Record<SearchTab, SearchTabCount>;

export type SearchTabVm = {
  id: SearchTab;
  label: string;
  href: string;
};

export type SearchArtistLinkVm = {
  name: string;
  href: string;
};

export type SearchEmptyCopy = {
  title: string;
  description: string;
};

const TAB_LABELS: Record<SearchTab, string> = {
  available: "Available",
  sold: "Sold",
  exhibitions: "Exhibitions",
  articles: "Articles",
};

const EMPTY_TITLES: Record<SearchTab, string> = {
  available: "No available items",
  sold: "No sold items",
  exhibitions: "No exhibitions",
  articles: "No articles",
};

export function isArtworkTab(tab: SearchTab): tab is "available" | "sold" {
  return tab === "available" || tab === "sold";
}

export function searchTabLabel(tab: SearchTab, count: number | null): string {
  return count === null ? TAB_LABELS[tab] : `${TAB_LABELS[tab]} (${count})`;
}

/** Tabs whose source is switched off are left out; a hidden active tab falls back to Available. */
export function resolveActiveTab(requested: SearchTab, counts: SearchTabCounts): SearchTab {
  return counts[requested] === "hidden" ? "available" : requested;
}

export function buildSearchTabs(state: SearchUrlState, counts: SearchTabCounts): SearchTabVm[] {
  return SEARCH_TABS.flatMap((tab) => {
    const count = counts[tab];
    if (count === "hidden") return [];
    return [
      {
        id: tab,
        label: searchTabLabel(tab, count),
        href: searchFilterHref(state, { tab }),
      },
    ];
  });
}

export function searchResultCountLabel(count: number): string {
  return `${count} result${count === 1 ? "" : "s"}`;
}

/** One artist whose name is exactly the query (ignoring case and spacing); otherwise none. */
export function findExactArtistMatch(
  artists: readonly PublicArtistSummary[],
  query: string,
): SearchArtistLinkVm | null {
  const normalise = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-GB");
  const needle = normalise(query);
  const match = artists.find((artist) => normalise(artist.name) === needle);
  return match ? { name: match.name, href: artistHref(match.slug) } : null;
}

export function searchEmptyCopy(tab: SearchTab, filtered: boolean): SearchEmptyCopy {
  return {
    title: EMPTY_TITLES[tab],
    description: filtered
      ? "Try removing a filter or a different spelling."
      : "Try a different spelling or browse all artworks.",
  };
}
