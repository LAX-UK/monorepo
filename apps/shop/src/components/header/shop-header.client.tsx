"use client";

import type { ShopHeaderNavData } from "@/components/header/header-nav.config";
import { buildShopMegaMenuSections } from "@/components/header/header-nav.config";
import { ShopBottomBar } from "@/components/header/shop-bottom-bar.client";
import { ShopHeaderAccountUtility } from "@/components/header/shop-header-account-utility";
import { ShopHeaderBasketLink } from "@/components/header/shop-header-basket-link";
import { ShopHeaderSearch } from "@/components/header/shop-header-search.client";
import { shopMegaMenuSectionActive } from "@/components/header/shop-mega-menu-active";
import { ShopMegaMenu } from "@/components/header/shop-mega-menu.client";
import { ShopThemeToggle } from "@/components/header/shop-theme-toggle";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import type { AccountChromeState, LaxFamilyLinkVm } from "@auction/lax-ecosystem";
import {
  LaxFamilyBar,
  LaxLogo,
  MarketingPhoneMenu,
  MarketingTopBarSlots,
} from "@auction/marketing-ui";
import {
  MarketingChromeIconButton,
  MarketingCloseIcon,
  MarketingMenuIcon,
  headerChromeClassName,
  headerChromeIconClass,
  useHeaderChrome,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Help links on the right of the LAX top bar, and in the phone menu. */
export const SHOP_HELP_LINKS = [
  { label: "Delivery", href: "/delivery" },
  { label: "Returns", href: "/returns" },
  { label: "Help", href: "/help" },
] as const;

type ShopHeaderClientProps = {
  account: AccountChromeState;
  /** The LAX top bar: the products, then LAX Account. */
  familyLinks?: LaxFamilyLinkVm[];
  basketCount: number;
  /** An order needs the person, so the Account tab and entry show a dot. */
  accountNeedsAction?: boolean;
  merchandiseEnabled: boolean;
  navData?: ShopHeaderNavData | null;
};

export function ShopHeaderClient({
  account,
  familyLinks = [],
  basketCount,
  accountNeedsAction = false,
  merchandiseEnabled,
  navData = null,
}: ShopHeaderClientProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [megaMenuResetNonce, setMegaMenuResetNonce] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Every Shop page, the home page included, opens on the page surface, so the header is solid.
  const { isTransparent, atTop, headerTone, headerRef, attachHeader } = useHeaderChrome({
    transparent: false,
    overlayOpen: megaOpen || menuOpen || searchOpen,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  const closeMenu = () => setMenuOpen(false);
  const handleAccountMenuOpenChange = (open: boolean) => {
    setAccountMenuOpen(open);
    if (open) setMegaMenuResetNonce((nonce) => nonce + 1);
  };

  // From 1024px the LAX top bar scrolls away while the main row stays: publish how far to slide.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const bar = header.querySelector<HTMLElement>('[data-testid="lax-family-bar"]');
      const shift = Math.min(Math.max(window.scrollY, 0), bar?.offsetHeight ?? 0);
      header.style.setProperty("--shop-top-bar-shift", `${shift}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [headerRef]);

  const homeLockup = (onClick?: () => void) => (
    <Link
      href="/"
      className={cn("shrink-0 rounded-sm", FOCUS_RING)}
      aria-label="LAX Shop home"
      {...(onClick ? { onClick } : {})}
    >
      <LaxLogo kind="shop" className="shop-header__logo shop-header__logo--compact" />
      <LaxLogo kind="shop-exchange" className="shop-header__logo shop-header__logo--full" />
    </Link>
  );

  const searchProps = {
    headerTone,
    open: searchOpen,
    onOpenChange: setSearchOpen,
  } as const;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <header
          ref={attachHeader}
          data-testid="shop-header"
          data-chrome-variant="solid"
          data-at-top={atTop ? "true" : "false"}
          data-header-tone={headerTone}
          className={cn("shop-header", headerChromeClassName(isTransparent, megaOpen))}
        >
          <div
            className={cn(
              "mx-auto flex max-w-[var(--container-max,1440px)] flex-col",
              MARKETING_PAGE_GUTTER_X,
            )}
          >
            <LaxFamilyBar links={familyLinks} tone={headerTone} helpLinks={SHOP_HELP_LINKS} />

            <div className="flex h-14 items-center lg:h-[72px]">
              <ShopMegaMenu
                pathname={pathname}
                merchandiseEnabled={merchandiseEnabled}
                navData={navData}
                headerTone={headerTone}
                megaMenuResetKey={`${pathname}:${megaMenuResetNonce}`}
                onOpenChange={(open) => {
                  setMegaOpen(open);
                  if (open) setAccountMenuOpen(false);
                }}
                onNavigate={closeMenu}
                leading={homeLockup()}
                trailing={
                  <MarketingTopBarSlots
                    className="shrink-0 justify-end lg:[&>[data-slot=menu]]:hidden"
                    searchField={<ShopHeaderSearch variant="field" {...searchProps} />}
                    searchIcon={<ShopHeaderSearch variant="icon" {...searchProps} />}
                    productAction={
                      <div className="flex items-center gap-1 lg:gap-3">
                        <div className="hidden lg:flex">
                          <ShopThemeToggle headerTone={headerTone} />
                        </div>
                        <ShopHeaderBasketLink
                          itemCount={basketCount}
                          headerTone={headerTone}
                          onNavigate={closeMenu}
                        />
                      </div>
                    }
                    account={
                      <div
                        data-testid="shop-header-desktop-account"
                        onPointerDownCapture={() => {
                          const megaTriggerExpanded = headerRef.current?.querySelector(
                            '[aria-controls="shop-header-megamenu"][aria-expanded="true"]',
                          );
                          if (megaTriggerExpanded) setMegaMenuResetNonce((nonce) => nonce + 1);
                        }}
                      >
                        <ShopHeaderAccountUtility
                          account={account}
                          headerTone={headerTone}
                          attention={accountNeedsAction}
                          open={accountMenuOpen}
                          onOpenChange={handleAccountMenuOpenChange}
                        />
                      </div>
                    }
                    menuButton={
                      <MarketingChromeIconButton
                        ref={menuButtonRef}
                        label={menuOpen ? "Close menu" : "Open menu"}
                        className={headerChromeIconClass(headerTone)}
                        aria-haspopup="dialog"
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                      >
                        {menuOpen ? <MarketingCloseIcon /> : <MarketingMenuIcon />}
                      </MarketingChromeIconButton>
                    }
                  />
                }
              />
            </div>

            <MarketingPhoneMenu
              open={menuOpen}
              onOpenChange={setMenuOpen}
              resetKey={pathname}
              lockup={homeLockup(closeMenu)}
              familyLinks={familyLinks}
              sections={buildShopMegaMenuSections(merchandiseEnabled, navData)}
              isSectionActive={(section) => shopMegaMenuSectionActive(pathname, section)}
              isLinkCurrent={(href) => pathname === href || pathname.startsWith(`${href}/`)}
              helpLinks={SHOP_HELP_LINKS}
              returnFocusRef={menuButtonRef}
              themeSlot={
                <>
                  <span className="font-label text-sm font-semibold text-on-surface-variant">
                    Theme
                  </span>
                  <ShopThemeToggle />
                </>
              }
            />
          </div>
        </header>
      </TooltipProvider>

      <ShopBottomBar
        pathname={pathname}
        basketCount={basketCount}
        accountNeedsAction={accountNeedsAction}
        viewer={
          account.kind === "authenticated"
            ? { displayName: account.displayName, email: account.email }
            : null
        }
        signInHref={shopStorefrontLoginHref(pathname || "/")}
        onSearch={() => setSearchOpen(true)}
      />
    </>
  );
}
