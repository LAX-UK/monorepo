"use client";

import { LaxProductSwitcher } from "@/components/ecosystem/lax-product-switcher";
import { ShopHeaderAccountUtility } from "@/components/header/shop-header-account-utility";
import { ShopHeaderBasketLink } from "@/components/header/shop-header-basket-link";
import { ShopMegaMenu } from "@/components/header/shop-mega-menu.client";
import { ShopMobileNavDrawer } from "@/components/header/shop-mobile-nav-drawer";
import { ShopThemeToggle } from "@/components/header/shop-theme-toggle";
import { ShopLaxLogo } from "@/components/layout/shop-lax-logo";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  MarketingChromeIconButton,
  MarketingCloseIcon,
  type MarketingHeaderTone,
  MarketingMenuIcon,
  headerChromeIconClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const SCROLL_FADE_THRESHOLD_PX = 12;

type ShopHeaderClientProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  basketCount: number;
};

export function ShopHeaderClient({ account, productLinks, basketCount }: ShopHeaderClientProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [megaMenuResetNonce, setMegaMenuResetNonce] = useState(0);
  const [atTop, setAtTop] = useState(true);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastHeaderHeightRef = useRef(0);

  const transparentHome = pathname === "/";

  const setHeaderNode = useCallback((el: HTMLElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    headerRef.current = el;
    if (!el) return;

    const sync = () => {
      const h = el.offsetHeight;
      if (h === lastHeaderHeightRef.current) return;
      lastHeaderHeightRef.current = h;
      document.documentElement.style.setProperty("--header-height", `${h}px`);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    resizeObserverRef.current = ro;
  }, []);

  useLayoutEffect(() => {
    if (!transparentHome) {
      setAtTop(true);
      return;
    }
    const onScroll = () => {
      setAtTop(window.scrollY <= SCROLL_FADE_THRESHOLD_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentHome]);

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
  const isTransparent = transparentHome && atTop && !megaOpen && !menuOpen;
  const headerTone: MarketingHeaderTone = isTransparent ? "on-dark" : "on-light";

  return (
    <TooltipProvider delayDuration={200}>
      <header
        ref={setHeaderNode}
        data-testid="shop-header"
        data-chrome-variant={transparentHome ? "transparentUntilScroll" : "solid"}
        data-at-top={atTop ? "true" : "false"}
        data-header-tone={headerTone}
        className={cn(
          "fixed top-0 z-50 w-full border-b pt-[env(safe-area-inset-top,0px)] transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none",
          isTransparent
            ? "border-transparent bg-transparent"
            : cn(
                "border-nav-border bg-surface shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface",
                megaOpen && "border-transparent shadow-none backdrop-blur-none",
              ),
        )}
      >
        <div
          className={cn(
            "mx-auto flex max-w-[var(--container-max,1440px)] flex-col gap-4 py-2 lg:gap-4 lg:pt-3 lg:pb-4",
            MARKETING_PAGE_GUTTER_X,
          )}
        >
          <div className="hidden lg:block">
            <LaxProductSwitcher links={productLinks} headerTone={headerTone} />
          </div>

          <ShopMegaMenu
            pathname={pathname}
            headerTone={headerTone}
            megaMenuResetKey={`${pathname}:${megaMenuResetNonce}`}
            onOpenChange={(open) => {
              setMegaOpen(open);
              if (open) setAccountMenuOpen(false);
            }}
            onNavigate={closeMenu}
            leading={
              <Link
                href="/"
                className={cn("min-w-[76px] shrink-0 rounded-sm", FOCUS_RING)}
                aria-label="LAX Shop home"
              >
                <ShopLaxLogo variant="header" className="shop-header__logo" />
              </Link>
            }
            trailing={
              <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:gap-3">
                <ShopHeaderBasketLink
                  itemCount={basketCount}
                  headerTone={headerTone}
                  onNavigate={closeMenu}
                />
                <div className="hidden lg:flex">
                  <ShopThemeToggle headerTone={headerTone} />
                </div>
                <div
                  className="hidden lg:flex"
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
                    productLinks={productLinks}
                    headerTone={headerTone}
                    open={accountMenuOpen}
                    onOpenChange={handleAccountMenuOpenChange}
                  />
                </div>
                <MarketingChromeIconButton
                  ref={menuButtonRef}
                  label={menuOpen ? "Close menu" : "Open menu"}
                  className={cn("lg:hidden", headerChromeIconClass(headerTone))}
                  aria-haspopup="dialog"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  {menuOpen ? <MarketingCloseIcon /> : <MarketingMenuIcon />}
                </MarketingChromeIconButton>
              </div>
            }
          />

          <ShopMobileNavDrawer
            open={menuOpen}
            onOpenChange={setMenuOpen}
            pathname={pathname}
            account={account}
            productLinks={productLinks}
          />
        </div>
      </header>
    </TooltipProvider>
  );
}
