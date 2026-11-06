"use client";

import { ArtGeneralEnquirySheet } from "@/components/enquiry/art-general-enquiry-sheet.client";
import { ArtAccountEntry } from "@/components/header/art-account-entry";
import { ArtHeaderFavoritesLink } from "@/components/header/art-header-favorites-link";
import { ArtLockup } from "@/components/header/art-lockup";
import { ArtPhoneMenu } from "@/components/header/art-phone-menu";
import { ArtThemeToggle } from "@/components/header/art-theme-toggle";
import { artRouteMayHaveHero } from "@/lib/layout/art-header-chrome.vm";
import { buildArtTopBarHelpLinks } from "@/lib/layout/art-help-links";
import { useArtHeroPresent } from "@/lib/layout/art-hero-presence";
import {
  type ArtHeaderNavData,
  buildArtMegaNavSections,
  buildArtSearchSuggestions,
  resolveArtNavKey,
} from "@/lib/layout/art-nav.vm";
import { ART_SEARCH_REQUEST_EVENT } from "@/lib/layout/art-search-request";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@auction/branding";
import type { AccountChromeState, LaxFamilyLinkVm, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  LaxFamilyBar,
  MARKETING_HEADER_CHROME,
  MarketingChromeIconButton,
  MarketingCloseIcon,
  MarketingHeaderMegaNav,
  MarketingHeaderSearch,
  MarketingMenuIcon,
  MarketingTopBarSlots,
  headerChromeClassName,
  headerChromeIconClass,
  useHeaderChrome,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const RECENT_SEARCHES_KEY = "lax-art:recent-searches";

/** The thin LAX top bar is 36px; it scrolls away and the 72px row stays. */
const TOP_BAR_HEIGHT_PX = 36;

type ArtHeaderClientProps = {
  account: AccountChromeState;
  productLinks: LaxProductLinkVm[];
  familyLinks: LaxFamilyLinkVm[];
  headerNav: ArtHeaderNavData | null;
  /** A gallery reply to an enquiry is waiting. */
  replyDot?: boolean;
};

export function ArtHeaderClient({
  account,
  productLinks,
  familyLinks,
  headerNav,
  replyDot = false,
}: ArtHeaderClientProps) {
  const pathname = usePathname();
  const activeKey = resolveArtNavKey(pathname);
  const megaSections = useMemo(() => buildArtMegaNavSections(headerNav), [headerNav]);
  const searchSuggestions = useMemo(() => buildArtSearchSuggestions(headerNav), [headerNav]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [megaOpen, setMegaOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [fieldSearchOpen, setFieldSearchOpen] = useState(false);
  const [searchRequest, setSearchRequest] = useState(0);
  const heroPresent = useArtHeroPresent();
  const overHero = artRouteMayHaveHero(pathname) && heroPresent;
  const { isTransparent, atTop, headerTone, headerRef, attachHeader } = useHeaderChrome({
    transparent: overHero,
    overlayOpen: menuOpen || megaOpen || searchOpen || fieldSearchOpen,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // The bottom bar's Search tab asks for the search sheet.
  useEffect(() => {
    const onRequest = () => setSearchRequest((count) => count + 1);
    window.addEventListener(ART_SEARCH_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(ART_SEARCH_REQUEST_EVENT, onRequest);
  }, []);

  // The 36px top bar follows the page up and off; the main row stays fixed.
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const onScroll = () => {
      const shift = Math.min(Math.max(window.scrollY, 0), TOP_BAR_HEIGHT_PX);
      header.style.setProperty("--art-top-bar-shift", `${shift}px`);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [headerRef]);

  const helpLinks = buildArtTopBarHelpLinks(
    account.kind === "authenticated"
      ? (className) => (
          <ArtGeneralEnquirySheet
            viewerKind="authenticated"
            contact={{
              name: account.displayName,
              email: account.email,
              phone: account.verifiedPhone ?? "",
            }}
            renderTrigger={(open) => (
              <Button type="button" variant="link" className={className} onClick={open}>
                Enquire
              </Button>
            )}
          />
        )
      : undefined,
  );

  return (
    <header
      ref={attachHeader}
      data-testid="art-header"
      data-chrome-variant={overHero ? "transparentUntilScroll" : "solid"}
      data-at-top={atTop ? "true" : "false"}
      data-header-tone={headerTone}
      className={cn(
        MARKETING_HEADER_CHROME,
        headerChromeClassName(isTransparent, megaOpen),
        "lg:-translate-y-[var(--art-top-bar-shift,0px)]",
      )}
    >
      <div
        className={cn(
          "mx-auto flex max-w-[var(--container-max,1440px)] flex-col",
          MARKETING_PAGE_GUTTER_X,
        )}
      >
        <LaxFamilyBar links={familyLinks} helpLinks={helpLinks} tone={headerTone} />

        <div className="flex h-14 items-center md:h-[72px]">
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
                className={cn("min-w-[76px] shrink-0 rounded-sm", FOCUS_RING)}
                aria-label="lax.art home"
              >
                <ArtLockup />
              </Link>
            }
            trailing={
              <MarketingTopBarSlots
                className="shrink-0 justify-end"
                searchField={
                  <MarketingHeaderSearch
                    action="/search"
                    recentStorageKey={RECENT_SEARCHES_KEY}
                    suggestions={searchSuggestions}
                    placeholder="Search artworks and artists"
                    headerTone={headerTone}
                    onOpenChange={setFieldSearchOpen}
                    className="w-full"
                  />
                }
                searchIcon={
                  <MarketingHeaderSearch
                    action="/search"
                    recentStorageKey={RECENT_SEARCHES_KEY}
                    suggestions={searchSuggestions}
                    placeholder="Search artworks and artists"
                    headerTone={headerTone}
                    compactBelowDesktop
                    iconOnly
                    openRequest={searchRequest}
                    onOpenChange={setSearchOpen}
                  />
                }
                productAction={
                  <div className="flex items-center gap-1">
                    <div className="hidden lg:flex">
                      <ArtThemeToggle headerTone={headerTone} />
                    </div>
                    <ArtHeaderFavoritesLink headerTone={headerTone} />
                  </div>
                }
                account={
                  <ArtAccountEntry
                    account={account}
                    productLinks={productLinks}
                    pathname={pathname}
                    headerTone={headerTone}
                    replyDot={replyDot}
                  />
                }
                menuButton={
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
                }
              />
            }
          />
        </div>

        <ArtPhoneMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          pathname={pathname}
          activeKey={activeKey}
          familyLinks={familyLinks}
          returnFocusRef={menuButtonRef}
        />
      </div>
    </header>
  );
}
