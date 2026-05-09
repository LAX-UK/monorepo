"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import type { SessionUser } from "@/lib/data/contracts";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import { HeaderAuthChip } from "./header-auth-chip";
import { HeaderMegaNav } from "./header-mega-nav";
import { HeaderSearchTrigger } from "./header-search";
import { HeaderUtilityBar } from "./header-utility-bar";
import { LaxLogo } from "./lax-logo";
import { MobileNavDrawer } from "./mobile-nav-drawer";
import { SiteHeaderChromeProvider, useSiteHeaderChrome } from "./site-header-chrome-context";
import { ThemeToggle } from "./theme-toggle";

type SiteHeaderChromeVariant = "solid" | "transparentUntilScroll";

type SiteHeaderProps = {
  user?: SessionUser | null;
  nav?: MegaMenuSection[];
  transparentPaths?: string[];
  chromeVariant?: SiteHeaderChromeVariant;
};

const SCROLL_FADE_THRESHOLD_PX = 12;

type SiteHeaderShellProps = SiteHeaderProps & {
  searchParams: ReturnType<typeof useSearchParams> | null;
};

function SiteHeaderShell({
  user: _user,
  nav: navProp,
  transparentPaths,
  chromeVariant,
  searchParams,
}: SiteHeaderShellProps) {
  void _user;
  const nav = navProp ?? emptyMegaMenuSections();
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const pathname = usePathname();
  const searchKey = searchParams == null ? "" : searchParams.toString();

  const resolvedVariant: SiteHeaderChromeVariant =
    chromeVariant ??
    (transparentPaths && pathname && transparentPaths.includes(pathname)
      ? "transparentUntilScroll"
      : "solid");

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile menu when the route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname, searchKey]);

  useLayoutEffect(() => {
    if (resolvedVariant !== "transparentUntilScroll") {
      setAtTop(true);
      return;
    }
    const onScroll = () => {
      setAtTop(window.scrollY <= SCROLL_FADE_THRESHOLD_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [resolvedVariant]);

  const isTransparent =
    resolvedVariant === "transparentUntilScroll" && atTop && !megaOpen && !menuOpen;

  const blendWithHero = false;

  return (
    <header
      data-chrome-variant={resolvedVariant}
      data-at-top={atTop ? "true" : "false"}
      data-blend-hero={blendWithHero ? "true" : "false"}
      className={cn(
        "fixed top-0 z-50 w-full border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-out motion-reduce:transition-none",
        isTransparent
          ? "border-transparent bg-transparent"
          : cn(
              "border-nav-border bg-surface shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-surface",
              megaOpen && "border-transparent shadow-none backdrop-blur-none",
            ),
      )}
    >
      <SiteHeaderChromeProvider value={{ blendWithHero }}>
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 pt-3 pb-4 md:px-10">
          <div className="hidden lg:block">
            <HeaderUtilityBar />
          </div>

          <HeaderMegaNav
            sections={nav}
            pathname={pathname}
            searchParams={searchParams}
            onOpenChange={setMegaOpen}
            logo={
              <Link
                href="/"
                className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
              >
                <LaxLogo variant="header" />
              </Link>
            }
            trailing={
              <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:max-w-[420px] lg:flex-none">
                <HeaderSearchTrigger />
                <ThemeToggle />
                <HeaderAuthChip variant="notifications" />
                <div className="lg:hidden">
                  <HeaderAuthChip variant="account" />
                </div>
                <MobileMenuIconButton menuOpen={menuOpen} onToggle={() => setMenuOpen((o) => !o)} />
              </div>
            }
          />
        </div>

        <MobileNavDrawer
          open={menuOpen}
          onOpenChange={setMenuOpen}
          pathname={pathname}
          searchParams={searchParams}
          sections={nav}
        />
      </SiteHeaderChromeProvider>
    </header>
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
  onToggle,
}: {
  menuOpen: boolean;
  onToggle: () => void;
}) {
  const { blendWithHero } = useSiteHeaderChrome();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "min-h-[44px] min-w-[44px] lg:hidden",
        blendWithHero
          ? "text-white hover:bg-white/10 hover:text-white dark:text-on-surface dark:hover:bg-surface-container-low dark:hover:text-on-surface"
          : "text-brand-800 hover:bg-page-bg dark:text-on-surface",
      )}
      aria-haspopup="dialog"
      aria-expanded={menuOpen}
      aria-label={menuOpen ? "Close menu" : "Open menu"}
      onClick={onToggle}
    >
      {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
    </Button>
  );
}
