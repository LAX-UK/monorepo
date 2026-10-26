"use client";

import {
  type ShopHeaderNavData,
  buildShopMegaMenuSections,
} from "@/components/header/header-nav.config";
import { shopMegaMenuSectionActive } from "@/components/header/shop-mega-menu-active";
import { ShopMobileAuthSection } from "@/components/header/shop-mobile-auth-section";
import { ShopThemeToggle } from "@/components/header/shop-theme-toggle";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { LaxLogo } from "@auction/marketing-ui";
import { MarketingMobileNavDrawer } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type ShopMobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  merchandiseEnabled: boolean;
  navData?: ShopHeaderNavData | null;
};

export function ShopMobileNavDrawer({
  open,
  onOpenChange,
  pathname,
  account,
  productLinks,
  merchandiseEnabled,
  navData = null,
}: ShopMobileNavDrawerProps) {
  const close = () => onOpenChange(false);

  return (
    <MarketingMobileNavDrawer
      open={open}
      onOpenChange={onOpenChange}
      resetKey={pathname}
      sections={buildShopMegaMenuSections(merchandiseEnabled, navData)}
      isSectionActive={(section) => shopMegaMenuSectionActive(pathname, section)}
      isLinkCurrent={(href) => pathname === href || pathname.startsWith(`${href}/`)}
      logo={
        <Link
          href="/"
          className={cn("shrink-0 rounded-sm", FOCUS_RING)}
          aria-label="LAX Shop home"
          onClick={close}
        >
          <LaxLogo kind="shop" className="shop-header__logo" />
        </Link>
      }
      themeSlot={
        <>
          <span className="font-label text-sm font-semibold text-on-surface-variant">Theme</span>
          <ShopThemeToggle />
        </>
      }
      footerSlot={
        <ShopMobileAuthSection account={account} productLinks={productLinks} onNavigate={close} />
      }
    />
  );
}
