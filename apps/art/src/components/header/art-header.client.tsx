"use client";

import { ArtHeaderAccountMenu } from "@/components/header/art-header-account-menu";
import { ArtHeaderFavoritesLink } from "@/components/header/art-header-favorites-link";
import { ArtMobileNavDrawer } from "@/components/header/art-mobile-nav-drawer";
import { ArtThemeToggle } from "@/components/header/art-theme-toggle";
import { buildArtNavItems } from "@/lib/layout/art-nav.vm";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  LaxLogo,
  MARKETING_HEADER_CHROME,
  MarketingChromeIconButton,
  MarketingCloseIcon,
  MarketingMenuIcon,
  MarketingSearchIcon,
  MarketingUtilityBar,
  type MarketingUtilityBarItem,
  headerChromeIconClass,
  headerProductLinkClass,
  headerUtilityLinkClass,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type ArtHeaderClientProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
};

export function ArtHeaderClient({ account, productLinks }: ArtHeaderClientProps) {
  const pathname = usePathname();
  const nav = buildArtNavItems(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpenRef = useRef(false);
  const headerRef = useRef<HTMLElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastHeaderHeightRef = useRef(0);

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
    const el = headerRef.current;
    if (!el) return;
    const h = el.offsetHeight;
    document.documentElement.style.setProperty("--header-height", `${h}px`);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the mobile menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // The drawer has no Radix trigger, so focus is handed back to the menu button once the trap releases.
  useEffect(() => {
    if (wasMenuOpenRef.current && !menuOpen) menuButtonRef.current?.focus();
    wasMenuOpenRef.current = menuOpen;
  }, [menuOpen]);

  const headerTone = "on-light" as const;
  const utilityItems = productLinks.map((link) => ({
    label: link.label,
    href: link.href,
    current: link.current,
  }));

  return (
    <header
      ref={setHeaderNode}
      data-testid="art-header"
      data-header-tone={headerTone}
      className={cn(
        MARKETING_HEADER_CHROME,
        "fixed top-0 z-50 w-full border-b border-nav-border bg-surface/95 pt-[env(safe-area-inset-top,0px)] shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[var(--container-max,1440px)] flex-col gap-3 py-2 lg:gap-4 lg:pt-3 lg:pb-4",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        {utilityItems.length > 0 ? (
          <div className="hidden lg:block">
            <MarketingUtilityBar
              items={utilityItems}
              resolveLinkClassName={(item: MarketingUtilityBarItem) =>
                headerProductLinkClass(headerTone, item.current ?? false)
              }
            />
          </div>
        ) : null}

        <div className="flex h-14 items-center justify-between gap-4 lg:h-16">
          <Link
            href="/"
            className={cn("min-w-[76px] shrink-0 rounded-sm", FOCUS_RING)}
            aria-label="LAX Art home"
          >
            <LaxLogo variant="header" src="/brand/lax-logo.svg" className="art-header__logo" />
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                className={headerUtilityLinkClass(headerTone, item.active)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
            <Link
              href="/search"
              aria-label="Search"
              className={cn(
                "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm",
                headerChromeIconClass(headerTone),
                FOCUS_RING,
              )}
            >
              <MarketingSearchIcon className="size-5" aria-hidden />
            </Link>
            {/* Below md the bottom tab bar carries Favourites. */}
            <div className="hidden md:flex">
              <ArtHeaderFavoritesLink />
            </div>
            <div className="hidden lg:flex">
              <ArtThemeToggle headerTone={headerTone} />
            </div>
            <div className="hidden lg:flex" data-testid="art-header-desktop-account">
              <ArtHeaderAccountMenu account={account} productLinks={productLinks} />
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
        </div>

        <ArtMobileNavDrawer
          open={menuOpen}
          onOpenChange={setMenuOpen}
          pathname={pathname}
          navItems={nav}
          account={account}
          productLinks={productLinks}
        />
      </div>
    </header>
  );
}
