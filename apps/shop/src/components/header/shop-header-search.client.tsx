"use client";

import {
  MarketingHeaderSearch,
  type MarketingHeaderSearchLoader,
  type MarketingHeaderSearchResultGroup,
  type MarketingHeaderTone,
} from "@auction/marketing-ui";

const RECENT_SEARCHES_KEY = "lax-shop:recent-searches";

/** Reads grouped editions and artists from the Shop's own suggestions route. */
export const loadShopSearchResults: MarketingHeaderSearchLoader = async (query, signal) => {
  const response = await fetch(`/search/suggestions?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error(`Search suggestions failed (${response.status})`);
  const body = (await response.json()) as { groups?: MarketingHeaderSearchResultGroup[] };
  return body.groups ?? [];
};

type ShopHeaderSearchProps = {
  headerTone: MarketingHeaderTone;
  onOpenChange?: (open: boolean) => void;
};

/** Header search: a field on desktop, an icon and a full-screen sheet on phones. */
export function ShopHeaderSearch({ headerTone, onOpenChange }: ShopHeaderSearchProps) {
  return (
    <MarketingHeaderSearch
      action="/artworks"
      recentStorageKey={RECENT_SEARCHES_KEY}
      placeholder="Search editions and artists"
      loadResults={loadShopSearchResults}
      compactBelowDesktop
      headerTone={headerTone}
      {...(onOpenChange ? { onOpenChange } : {})}
    />
  );
}
