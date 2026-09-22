"use client";

import { shopMegaMenuSections } from "@/components/header/header-nav.config";
import { shopMegaMenuSectionActive } from "@/components/header/shop-mega-menu-active";
import { MarketingHeaderMegaNav, type MarketingHeaderTone } from "@auction/marketing-ui";
import type { ReactNode } from "react";

const MEGAMENU_PANEL_ID = "shop-header-megamenu";

type ShopMegaMenuProps = {
  pathname: string;
  headerTone?: MarketingHeaderTone;
  megaMenuResetKey?: string;
  onOpenChange?: (open: boolean) => void;
  onNavigate: () => void;
  leading: ReactNode;
  trailing: ReactNode;
};

export function ShopMegaMenu({
  pathname,
  headerTone = "on-light",
  megaMenuResetKey,
  onOpenChange,
  onNavigate,
  leading,
  trailing,
}: ShopMegaMenuProps) {
  return (
    <MarketingHeaderMegaNav
      sections={shopMegaMenuSections}
      isSectionActive={(section) => shopMegaMenuSectionActive(pathname, section)}
      resetKey={megaMenuResetKey ?? pathname}
      logo={leading}
      trailing={trailing}
      headerTone={headerTone}
      panelId={MEGAMENU_PANEL_ID}
      onPanelLinkClick={onNavigate}
      {...(onOpenChange ? { onOpenChange } : {})}
    />
  );
}
