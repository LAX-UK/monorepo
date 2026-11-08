"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { useAppSession } from "@/lib/auth/use-app-session";
import { bidHeroPresence, bidRouteMayHaveHero } from "@/lib/layout/bid-hero-presence";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { MARKETING_PAGE_GUTTER_X } from "@/lib/marketing/chrome";
import { useMarketingHeaderTitle } from "@/lib/marketing/marketing-header-title-context";
import { restoreMegaMenuAuthedHrefs } from "@/lib/marketing/mega-menu-href-rewrite";
import type { LaxFamilyLinkVm, LaxProductLinkVm } from "@auction/lax-ecosystem";
import {
  LaxFamilyBar,
  MarketingTopBarSlots,
  headerChromeClassName,
  useHeaderChrome,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Menu, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { AccountNeedsYouProvider } from "./account-switcher/account-needs-you";
import { BidAttentionPrompt } from "./bid-attention-prompt";
import { BidHeaderAccount } from "./bid-header-account";
import { BidHeaderLockup } from "./bid-header-lockup";
import { BidPhoneAccount } from "./bid-phone-account";
import { BidPhoneMenu } from "./bid-phone-menu";
import { HeaderMegaNav } from "./header-mega-nav";
import { utilityNav } from "./header-nav-config";
import { HeaderSearchTrigger } from "./header-search";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderChromeVariant = "solid" | "transparentUntilScroll";

type SiteHeaderProps = {
  nav?: MegaMenuSection[];
  chromeVariant?: SiteHeaderChromeVariant;
  laxProductLinks?: LaxProductLinkVm[];
  /** The LAX top bar: the products, then LAX Account. */
  familyLinks?: LaxFamilyLinkVm[];
};

type SiteHeaderShellProps = SiteHeaderProps & {
  searchParams: ReturnType<typeof useSearchParams> | null;
};

function SiteHeaderShell({
  nav: navProp,
  chromeVariant,
  searchParams,
  laxProductLinks = [],
  familyLinks = [],
}: SiteHeaderShellProps) {
  const { user } = useAppSession();
  const nav = useMemo(() => {
    const base = navProp ?? emptyMegaMenuSections();
    return user ? restoreMegaMenuAuthedHrefs(base) : base;
  }, [navProp, user]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const pathname = usePathname();
  const searchKey = searchParams == null ? "" : searchParams.toString();
  const { title: marketingPageTitle } = useMarketingHeaderTitle();

  // Over a cover photograph the header starts transparent and goes solid on scroll; the page says
  // whether one is there (the cover registers itself), the route only whether one could be.
  const heroPresent = bidHeroPresence.useHeroPresent();
  const overHero = bidRouteMayHaveHero(pathname) && heroPresent;
  const resolvedVariant: SiteHeaderChromeVariant =
    chromeVariant ?? (overHero ? "transparentUntilScroll" : "solid");

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, searchKey]);

  const { isTransparent, atTop, headerTone, attachHeader } = useHeaderChrome({
    transparent: resolvedVariant === "transparentUntilScroll",
    overlayOpen: megaOpen || menuOpen,
    // Sticky sub-chrome on Bid positions itself from scroll events, so a height change re-runs it.
    onHeightChange: () => window.dispatchEvent(new Event("scroll")),
  });
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <header
        ref={attachHeader}
        data-chrome-variant={resolvedVariant}
        data-at-top={atTop ? "true" : "false"}
        data-header-tone={headerTone}
        className={headerChromeClassName(isTransparent, megaOpen)}
      >
        <div className={cn("mx-auto max-w-[var(--container-max,1440px)]", MARKETING_PAGE_GUTTER_X)}>
          {/* 36px, from 1024px. About us, Contact us and FAQ sit at its right. */}
          <LaxFamilyBar links={familyLinks} helpLinks={utilityNav} tone={headerTone} />

          {/* The main row: the slim 56px bar up to 1023px, 72px on a desktop. */}
          <div className="flex h-14 items-center lg:h-[72px]">
            <HeaderMegaNav
              sections={nav}
              pathname={pathname}
              searchParams={searchParams}
              onOpenChange={setMegaOpen}
              headerTone={headerTone}
              logo={<BidHeaderLockup tone={headerTone} />}
              trailing={
                // One provider for the phone account button and the account menu, so the
                // "needs you" numbers are read once when either list opens.
                <AccountNeedsYouProvider enabled={user !== null}>
                  <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:gap-3">
                    {/* From 640px the attention prompt is a chip in the row; below it is the
                      strip under the bar. */}
                    <BidAttentionPrompt placement="bar" />
                    <BidPhoneAccount />
                    <MarketingTopBarSlots
                      searchField={
                        <HeaderSearchTrigger tone={headerTone} layout="pill" fullBarFrom="xl" />
                      }
                      searchIcon={
                        <HeaderSearchTrigger tone={headerTone} layout="icon" fullBarFrom="xl" />
                      }
                      productAction={
                        <div className="hidden lg:flex">
                          <ThemeToggle headerTone={headerTone} />
                        </div>
                      }
                      account={
                        <BidHeaderAccount
                          headerTone={headerTone}
                          laxProductLinks={laxProductLinks}
                        />
                      }
                      menuButton={
                        <MobileMenuIconButton
                          ref={menuButtonRef}
                          menuOpen={menuOpen}
                          headerTone={headerTone}
                          onToggle={() => setMenuOpen((o) => !o)}
                        />
                      }
                    />
                  </div>
                </AccountNeedsYouProvider>
              }
            />
          </div>
        </div>
        {/* Edge to edge under the bar, outside the page gutter. */}
        <BidAttentionPrompt placement="strip" />
        {marketingPageTitle ? (
          <div
            className={cn("mx-auto max-w-[var(--container-max,1440px)]", MARKETING_PAGE_GUTTER_X)}
          >
            <div className="site-header-page-title border-t border-nav-border px-2 pb-2 pt-1 lg:hidden">
              <p className="truncate text-center font-headline text-sm font-semibold text-on-surface">
                {marketingPageTitle}
              </p>
            </div>
          </div>
        ) : null}

        <BidPhoneMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          pathname={pathname}
          searchParams={searchParams}
          sections={nav}
          familyLinks={familyLinks}
          returnFocusRef={menuButtonRef}
        />
      </header>
    </>
  );
}

function SiteHeaderWithSearchParams(props: SiteHeaderProps) {
  const searchParams = useSearchParams();
  return <SiteHeaderShell {...props} searchParams={searchParams} />;
}

export function SiteHeader(props: SiteHeaderProps) {
  return (
    <Suspense fallback={<SiteHeaderShell {...props} searchParams={null} />}>
      <SiteHeaderWithSearchParams {...props} />
    </Suspense>
  );
}

const MobileMenuIconButton = forwardRef<
  HTMLButtonElement,
  { menuOpen: boolean; headerTone: SiteHeaderTone; onToggle: () => void }
>(function MobileMenuIconButton({ menuOpen, headerTone, onToggle }, ref) {
  return (
    <ChromeIconButton
      ref={ref}
      label={menuOpen ? "Close menu" : "Open menu"}
      className={cn("lg:hidden", headerChromeIconClass(headerTone))}
      aria-haspopup="dialog"
      aria-expanded={menuOpen}
      onClick={onToggle}
    >
      {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
    </ChromeIconButton>
  );
});
