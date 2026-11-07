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
  /** "field" is the underlined field from 1280px; "icon" is the icon below it. */
  variant?: "field" | "icon";
  /** Shared by both triggers and the bottom bar's Search tab. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

/** Header search: a field from 1280px, an icon below it, and a full-screen sheet below 1024px. */
export function ShopHeaderSearch({
  headerTone,
  variant = "field",
  open,
  onOpenChange,
}: ShopHeaderSearchProps) {
  return (
    <MarketingHeaderSearch
      action="/artworks"
      recentStorageKey={RECENT_SEARCHES_KEY}
      placeholder="Search editions and artists"
      loadResults={loadShopSearchResults}
      compactBelowDesktop
      variant={variant}
      headerTone={headerTone}
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    />
  );
}
