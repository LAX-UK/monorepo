"use client";

import { buildShopBottomTabs, shopBottomBarHidden } from "@/components/header/shop-bottom-tabs";
import { MarketingBottomTabBar } from "@auction/marketing-ui";

type ShopBottomBarProps = {
  pathname: string;
  basketCount: number;
  accountNeedsAction: boolean;
  viewer: { displayName: string; email: string } | null;
  signInHref: string;
  onSearch: () => void;
};

/** Shop's docked tab bar on phones. Not drawn on checkout and payment routes. */
export function ShopBottomBar({ pathname, onSearch, ...tabs }: ShopBottomBarProps) {
  if (shopBottomBarHidden(pathname)) return null;
  return (
    <MarketingBottomTabBar
      tabs={buildShopBottomTabs(tabs)}
      pathname={pathname}
      onSearch={onSearch}
      accent="var(--color-product-accent)"
    />
  );
}
