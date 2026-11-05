"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { useBidAttention } from "@/hooks/use-bid-attention";
import { showsPublicBottomBar } from "@/lib/layout/bottom-chrome";
import { buildBidBottomTabs } from "@/lib/navigation/bid-bottom-tabs";
import {
  MarketingBottomTabBar,
  MarketingEyeIcon,
  MarketingGavelIcon,
  MarketingHomeIcon,
  MarketingSearchIcon,
  MarketingUserIcon,
} from "@auction/marketing-ui";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

const ICONS = {
  home: <MarketingHomeIcon />,
  auctions: <MarketingGavelIcon />,
  search: <MarketingSearchIcon />,
  watching: <MarketingEyeIcon />,
  account: <MarketingUserIcon />,
};

/**
 * LAX Bid's docked phone tab bar on the public pages. The signed-in account area has its own
 * bar and checkout has its pay bar, so this renders nothing there (one bar at a time). On the live
 * lot page it steps aside while the lot's bid bar holds the shared bottom slot.
 */
export function BidBottomTabBar() {
  const pathname = usePathname() ?? "/";
  const { signedIn, pending, attention } = useBidAttention();
  // While the session is still being read, link straight to the pages: the server sends a
  // guest to Sign in anyway, and the tabs never flash a Sign in address for a signed-in person.
  const tabs = useMemo(
    () => buildBidBottomTabs({ signedIn: signedIn || pending, attention, icons: ICONS }),
    [signedIn, pending, attention],
  );
  if (!showsPublicBottomBar(pathname)) return null;
  return (
    <MarketingBottomTabBar
      tabs={tabs}
      pathname={pathname}
      onSearch={openCommandPalette}
      accent="var(--color-product-accent)"
      ariaLabel="LAX Bid shortcuts"
      data-testid="bid-bottom-tab-bar"
    />
  );
}
