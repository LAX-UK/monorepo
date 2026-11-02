"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { useAppSession } from "@/lib/auth/use-app-session";
import { SITE_LOGO_SHORT_PATH } from "@/lib/brand";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@/lib/marketing/chrome";
import { useMarketingHeaderTitle } from "@/lib/marketing/marketing-header-title-context";
import { restoreMegaMenuAuthedHrefs } from "@/lib/marketing/mega-menu-href-rewrite";
import type { LaxFamilyLinkVm, LaxProductLinkVm } from "@auction/lax-ecosystem";
import { LaxFamilyBar, headerChromeClassName, useHeaderChrome } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { HeaderAttentionChip } from "./header-attention-chip";
import { HeaderAuthChip } from "./header-auth-chip";
import { HeaderMegaNav } from "./header-mega-nav";
import { HeaderSearchTrigger } from "./header-search";
import { HeaderUtilityBar } from "./header-utility-bar";
import { LaxLogo } from "./lax-logo";
import { MobileNavDrawer } from "./mobile-nav-drawer";
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

  const resolvedVariant: SiteHeaderChromeVariant = chromeVariant ?? "solid";

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

  return (
    <>
      <header
        ref={attachHeader}
        data-chrome-variant={resolvedVariant}
        data-at-top={atTop ? "true" : "false"}
        data-header-tone={headerTone}
        className={headerChromeClassName(isTransparent, megaOpen)}
      >
        <div
          className={cn(
            "mx-auto flex max-w-[var(--container-max,1440px)] flex-col gap-4 py-2 lg:gap-4 lg:pt-0 lg:pb-4",
            MARKETING_PAGE_GUTTER_X,
          )}
        >
          <LaxFamilyBar
            links={familyLinks}
            tone={headerTone}
            actions={<HeaderUtilityBar headerTone={headerTone} />}
          />

          <HeaderMegaNav
            sections={nav}
            pathname={pathname}
            searchParams={searchParams}
            onOpenChange={setMegaOpen}
            headerTone={headerTone}
            logo={
              <Link
                href="/"
                className={cn("site-header-logo shrink-0 rounded-sm sm:min-w-[76px]", FOCUS_RING)}
              >
                {/* Phones get the compact mark, as the workspace bar does, so the lockup never
                    crowds the attention chip and the account controls. */}
                <LaxLogo
                  variant="header"
                  imageSrc={SITE_LOGO_SHORT_PATH}
                  imageWidth={172}
                  imageHeight={201}
                  surfaceTone={headerTone}
                  className="sm:hidden [&_img]:h-8 [&_img]:w-auto"
                />
                <LaxLogo
                  variant="header"
                  imageWidth={1089}
                  imageHeight={331}
                  surfaceTone={headerTone}
                  className="max-sm:hidden"
                />
              </Link>
            }
            trailing={
              <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:gap-3">
                <HeaderAttentionChip />
                <HeaderSearchTrigger tone={headerTone} layout="both" fullBarFrom="2xl" />
                <div className="hidden lg:flex">
                  <ThemeToggle headerTone={headerTone} />
                </div>
                {/* Phones reach notifications from the account sheet, which keeps room for the chip. */}
                <div className="hidden sm:flex">
                  <HeaderAuthChip variant="notifications" headerTone={headerTone} />
                </div>
                <HeaderAuthChip
                  variant="account"
                  headerTone={headerTone}
                  laxProductLinks={laxProductLinks}
                />
                <MobileMenuIconButton
                  menuOpen={menuOpen}
                  headerTone={headerTone}
                  onToggle={() => setMenuOpen((o) => !o)}
                />
              </div>
            }
          />
          {marketingPageTitle ? (
            <div className="site-header-page-title border-t border-nav-border px-2 pb-2 pt-1 lg:hidden">
              <p className="truncate text-center font-headline text-sm font-semibold text-on-surface">
                {marketingPageTitle}
              </p>
            </div>
          ) : null}
        </div>

        <MobileNavDrawer
          open={menuOpen}
          onOpenChange={setMenuOpen}
          pathname={pathname}
          searchParams={searchParams}
          sections={nav}
          familyLinks={familyLinks}
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

function MobileMenuIconButton({
  menuOpen,
  headerTone,
  onToggle,
}: {
  menuOpen: boolean;
  headerTone: SiteHeaderTone;
  onToggle: () => void;
}) {
  return (
    <ChromeIconButton
      label={menuOpen ? "Close menu" : "Open menu"}
      className={cn("lg:hidden", headerChromeIconClass(headerTone))}
      aria-haspopup="dialog"
      aria-expanded={menuOpen}
      onClick={onToggle}
    >
      {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
    </ChromeIconButton>
  );
}
