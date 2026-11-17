"use client";

import { buildArtBottomTabs } from "@/lib/layout/art-bottom-tabs";
import { requestArtSearch } from "@/lib/layout/art-search-request";
import {
  MarketingAvatar,
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
  /**
   * The visitor is not read yet. The Account tab keeps its label and an empty icon space of the
   * same size, and Favourites and Account link to their pages (which send a guest to sign in), so
   * neither a guest's nor a member's look is drawn and then swapped.
   */
  pending?: boolean;
  signedOut: boolean;
  replyDot: boolean;
  /** The signed-in person, drawn as the Account tab's icon; null otherwise. */
  viewer?: { displayName: string; email: string } | null;
};

/** lax.art's docked tab bar below 768px: Home, Artworks, Search, Favourites, Account. */
export function ArtBottomBar({
  pending = false,
  signedOut,
  replyDot,
  viewer = null,
}: ArtBottomBarProps) {
  const pathname = usePathname();
  const tabs = buildArtBottomTabs({
    pathname,
    signedOut: !pending && signedOut,
    replyDot: !pending && replyDot,
    icons: {
      home: <MarketingHomeIcon aria-hidden className={ICON} />,
      artworks: <MarketingGridIcon aria-hidden className={ICON} />,
      search: <MarketingSearchIcon aria-hidden className={ICON} />,
      favourites: <MarketingHeartIcon aria-hidden className={ICON} />,
      account: pending ? (
        <span aria-hidden data-testid="art-bottom-bar-account-pending" className={ICON} />
      ) : viewer ? (
        <MarketingAvatar
          viewer={viewer}
          className="size-6 bg-surface-container-high text-[10px] font-semibold leading-none text-on-surface"
        />
      ) : (
        <MarketingUserIcon aria-hidden className={ICON} />
      ),
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
