"use client";

import { shopMegaMenuSections } from "@/components/header/header-nav.config";
import { shopMegaMenuSectionActive } from "@/components/header/shop-mega-menu-active";
import { ShopMobileAuthSection } from "@/components/header/shop-mobile-auth-section";
import { ShopThemeToggle } from "@/components/header/shop-theme-toggle";
import { ShopLaxLogo } from "@/components/layout/shop-lax-logo";
import { FOCUS_RING } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { MarketingMobileNavDrawer } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

type ShopMobileNavDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pathname: string;
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
};

export function ShopMobileNavDrawer({
  open,
  onOpenChange,
  pathname,
  account,
  productLinks,
}: ShopMobileNavDrawerProps) {
  const close = () => onOpenChange(false);

  return (
    <MarketingMobileNavDrawer
      open={open}
      onOpenChange={onOpenChange}
      resetKey={pathname}
      sections={shopMegaMenuSections}
      isSectionActive={(section) => shopMegaMenuSectionActive(pathname, section)}
      isLinkCurrent={(href) => pathname === href || pathname.startsWith(`${href}/`)}
      logo={
        <Link href="/" className={cn("shrink-0 rounded-sm", FOCUS_RING)} onClick={close}>
          <ShopLaxLogo variant="header" className="shop-header__logo" />
        </Link>
      }
      themeSlot={
        <>
          <span className="font-label text-xs font-semibold uppercase text-on-surface-variant">
            Theme
          </span>
          <ShopThemeToggle />
        </>
      }
      footerSlot={
        <ShopMobileAuthSection account={account} productLinks={productLinks} onNavigate={close} />
      }
    />
  );
}
