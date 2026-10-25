"use client";

import { ArtHeaderFavoritesLink } from "@/components/header/art-header-favorites-link";
import { ArtHeaderUtilityActions } from "@/components/header/art-header-utility-actions";
import { ArtMobileNavDrawer } from "@/components/header/art-mobile-nav-drawer";
import { ArtThemeToggle } from "@/components/header/art-theme-toggle";
import { artRouteMayHaveHero } from "@/lib/layout/art-header-chrome.vm";
import { useArtHeroPresent } from "@/lib/layout/art-hero-presence";
import {
  type ArtHeaderNavData,
  buildArtMegaNavSections,
  buildArtNavItems,
  buildArtSearchSuggestions,
  resolveArtNavKey,
} from "@/lib/layout/art-nav.vm";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import type { AccountChromeState, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  LaxLogo,
  MARKETING_HEADER_CHROME,
  MarketingChromeIconButton,
  MarketingCloseIcon,
  MarketingHeaderMegaNav,
  MarketingHeaderSearch,
  MarketingMenuIcon,
  MarketingSearchIcon,
  MarketingUtilityBar,
  type MarketingUtilityBarItem,
  headerChromeClassName,
  headerChromeIconClass,
  headerProductLinkClass,
  useHeaderChrome,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const RECENT_SEARCHES_KEY = "lax-art:recent-searches";

type ArtHeaderClientProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  headerNav: ArtHeaderNavData | null;
};

export function ArtHeaderClient({ account, productLinks, headerNav }: ArtHeaderClientProps) {
  const pathname = usePathname();
  const nav = buildArtNavItems(pathname);
  const activeKey = resolveArtNavKey(pathname);
  const megaSections = useMemo(() => buildArtMegaNavSections(headerNav), [headerNav]);
  const searchSuggestions = useMemo(() => buildArtSearchSuggestions(headerNav), [headerNav]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const wasMenuOpenRef = useRef(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const heroPresent = useArtHeroPresent();
  const overHero = artRouteMayHaveHero(pathname) && heroPresent;
  const { isTransparent, atTop, headerTone, attachHeader } = useHeaderChrome({
    transparent: overHero,
    overlayOpen: menuOpen || megaOpen || searchOpen,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the mobile menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // The drawer has no Radix trigger, so focus is handed back to the menu button once the trap releases.
  useEffect(() => {
    if (wasMenuOpenRef.current && !menuOpen) menuButtonRef.current?.focus();
    wasMenuOpenRef.current = menuOpen;
  }, [menuOpen]);

  const utilityItems = productLinks.map((link) => ({
    label: link.label,
    href: link.href,
    current: link.current,
  }));

  return (
    <header
      ref={attachHeader}
      data-testid="art-header"
      data-chrome-variant={overHero ? "transparentUntilScroll" : "solid"}
      data-at-top={atTop ? "true" : "false"}
      data-header-tone={headerTone}
      className={cn(MARKETING_HEADER_CHROME, headerChromeClassName(isTransparent, megaOpen))}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[var(--container-max,1440px)] flex-col py-2 lg:pt-1 lg:pb-0",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        <div className="hidden lg:block">
          <MarketingUtilityBar
            className="justify-start"
            items={utilityItems}
            resolveLinkClassName={(item: MarketingUtilityBarItem) =>
              headerProductLinkClass(headerTone, item.current ?? false)
            }
            trailing={
              <>
                {/* Figma has no theme control; the utility row keeps it out of the busy nav row. */}
                <ArtThemeToggle headerTone={headerTone} />
                <ArtHeaderUtilityActions
                  account={account}
                  productLinks={productLinks}
                  pathname={pathname}
                  headerTone={headerTone}
                />
              </>
            }
          />
        </div>

        <div className="flex h-14 items-center lg:h-auto">
          <MarketingHeaderMegaNav
            sections={megaSections}
            isSectionActive={(section) => section.key === activeKey}
            resetKey={pathname}
            panelId="art-header-megamenu"
            headerTone={headerTone}
            onOpenChange={setMegaOpen}
            logo={
              <Link
                href="/"
                className={cn("min-w-[76px] shrink-0 rounded-sm lg:py-2.5", FOCUS_RING)}
                aria-label="lax.art home"
              >
                <LaxLogo className="art-header__logo" />
              </Link>
            }
            trailing={
              <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
                {/* Narrower desktops cannot fit the five nav labels and the 231px field. */}
                <div className="hidden min-[88rem]:flex">
                  <MarketingHeaderSearch
                    action="/search"
                    recentStorageKey={RECENT_SEARCHES_KEY}
                    suggestions={searchSuggestions}
                    headerTone={headerTone}
                    onOpenChange={setSearchOpen}
                  />
                </div>
                <Link
                  href="/search"
                  aria-label="Search"
                  className={cn(
                    "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm min-[88rem]:hidden",
                    headerChromeIconClass(headerTone),
                    FOCUS_RING,
                  )}
                >
                  <MarketingSearchIcon className="size-5" aria-hidden />
                </Link>
                {/* Below md the bottom tab bar carries Favourites. */}
                <div className="hidden md:flex">
                  <ArtHeaderFavoritesLink headerTone={headerTone} />
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
