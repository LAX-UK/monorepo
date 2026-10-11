"use client";

import { type ArtNavKey, buildArtNavItems } from "@/lib/layout/art-nav.vm";
import {
  MarketingBottomTabBar,
  MarketingGridIcon,
  MarketingHomeIcon,
  MarketingSearchIcon,
  MarketingUserIcon,
} from "@auction/marketing-ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ICONS: Record<ArtNavKey, ReactNode> = {
  home: <MarketingHomeIcon aria-hidden className="size-5" />,
  artworks: <MarketingGridIcon aria-hidden className="size-5" />,
  search: <MarketingSearchIcon aria-hidden className="size-5" />,
  account: <MarketingUserIcon aria-hidden className="size-5" />,
};

export function ArtMobileBottomNav() {
  const pathname = usePathname();
  const items = buildArtNavItems(pathname, { includeHome: true }).map((item) => ({
    href: item.href,
    label: item.label,
    icon: ICONS[item.key],
    active: item.active,
  }));

  return <MarketingBottomTabBar items={items} data-testid="art-mobile-bottom-nav" />;
}
