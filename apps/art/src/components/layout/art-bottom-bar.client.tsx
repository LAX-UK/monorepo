"use client";

import { buildArtBottomTabs } from "@/lib/layout/art-bottom-tabs";
import { requestArtSearch } from "@/lib/layout/art-search-request";
import {
  MarketingBottomTabBar,
  MarketingGridIcon,
  MarketingHeartIcon,
  MarketingHomeIcon,
  MarketingSearchIcon,
  MarketingUserIcon,
} from "@auction/marketing-ui";
import { usePathname } from "next/navigation";

const ICON = "size-6";

type ArtBottomBarProps = {
  signedOut: boolean;
  replyDot: boolean;
};

/** lax.art's docked tab bar below 768px: Home, Artworks, Search, Favourites, Account. */
export function ArtBottomBar({ signedOut, replyDot }: ArtBottomBarProps) {
  const pathname = usePathname();
  const tabs = buildArtBottomTabs({
    pathname,
    signedOut,
    replyDot,
    icons: {
      home: <MarketingHomeIcon aria-hidden className={ICON} />,
      artworks: <MarketingGridIcon aria-hidden className={ICON} />,
      search: <MarketingSearchIcon aria-hidden className={ICON} />,
      favourites: <MarketingHeartIcon aria-hidden className={ICON} />,
      account: <MarketingUserIcon aria-hidden className={ICON} />,
    },
  });

  return (
    <MarketingBottomTabBar
      tabs={tabs}
      pathname={pathname}
      onSearch={requestArtSearch}
      data-testid="art-bottom-tab-bar"
    />
  );
}
