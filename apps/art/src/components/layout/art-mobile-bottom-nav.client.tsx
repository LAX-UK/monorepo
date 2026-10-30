"use client";

import { type ArtMobileNavKey, buildArtMobileNavItems } from "@/lib/layout/art-nav.vm";
import {
  MarketingBottomTabBar,
  MarketingGridIcon,
  MarketingHeartIcon,
  MarketingHomeIcon,
  MarketingUserIcon,
} from "@auction/marketing-ui";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ICONS: Record<ArtMobileNavKey, ReactNode> = {
  home: <MarketingHomeIcon aria-hidden className="size-5" />,
  discover: <MarketingGridIcon aria-hidden className="size-5" />,
  favorites: <MarketingHeartIcon aria-hidden className="size-5" />,
  account: <MarketingUserIcon aria-hidden className="size-5" />,
};

export function ArtMobileBottomNav() {
  const pathname = usePathname();
  const items = buildArtMobileNavItems(pathname).map((item) => ({
    href: item.href,
    label: item.label,
    icon: ICONS[item.key],
    active: item.active,
  }));

  return (
    <MarketingBottomTabBar
      variant="floating"
      items={items}
      className="art-bottom-nav"
      data-testid="art-mobile-bottom-nav"
    />
  );
}
