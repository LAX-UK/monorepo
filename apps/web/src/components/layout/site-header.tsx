"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { useMarketingHeaderTitle } from "@/lib/marketing/marketing-header-title-context";
import { cn } from "@auction/ui";
import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { type RefObject, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
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
  transparentPaths?: string[];
  chromeVariant?: SiteHeaderChromeVariant;
};

const SCROLL_FADE_THRESHOLD_PX = 12;

type SiteHeaderShellProps = SiteHeaderProps & {
  searchParams: ReturnType<typeof useSearchParams> | null;
};

function SiteHeaderHeightSync({ headerRef }: { headerRef: RefObject<HTMLElement | null> }) {
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    const sync = () => {
      document.documentElement.style.setProperty("--header-height", `${el.offsetHeight}px`);
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [headerRef]);

  return null;
}

function SiteHeaderShell({
  nav: navProp,
  transparentPaths,
  chromeVariant,
  searchParams,
}: SiteHeaderShellProps) {
  const nav = navProp ?? emptyMegaMenuSections();
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const pathname = usePathname();
  const searchKey = searchParams == null ? "" : searchParams.toString();
  const headerRef = useRef<HTMLElement>(null);
  const { title: marketingPageTitle } = useMarketingHeaderTitle();

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

  return (
    <>
      <SiteHeaderHeightSync headerRef={headerRef} />
      <header
        ref={headerRef}
        data-chrome-variant={resolvedVariant}
        data-at-top={atTop ? "true" : "false"}
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
        <div className="mx-auto flex max-w-[var(--container-max,1440px)] flex-col gap-6 px-4 py-2 md:px-6 lg:px-10 lg:pt-3 lg:pb-4">
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
                className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                <LaxLogo variant="header" />
              </Link>
            }
            trailing={
              <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:max-w-[420px] lg:gap-3 lg:flex-none">
                <ChromeIconButton
                  label="Open search"
                  className={cn(
                    "lg:hidden",
                    "text-brand-800 hover:bg-page-bg dark:text-on-surface",
                  )}
                  onClick={openCommandPalette}
                >
                  <Search aria-hidden />
                </ChromeIconButton>
                <HeaderSearchTrigger />
                <div className="hidden lg:flex">
                  <ThemeToggle />
                </div>
                <HeaderAuthChip variant="notifications" />
                <div className="lg:hidden">
                  <HeaderAuthChip variant="account" />
                </div>
                <MobileMenuIconButton menuOpen={menuOpen} onToggle={() => setMenuOpen((o) => !o)} />
              </div>
            }
          />
          {marketingPageTitle ? (
            <div className="border-t border-nav-border px-2 pb-2 pt-1 lg:hidden">
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
  onToggle,
}: {
  menuOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <ChromeIconButton
      label={menuOpen ? "Close menu" : "Open menu"}
      className={cn("lg:hidden", "text-brand-800 hover:bg-page-bg dark:text-on-surface")}
      aria-haspopup="dialog"
      aria-expanded={menuOpen}
      onClick={onToggle}
    >
      {menuOpen ? <X aria-hidden /> : <Menu aria-hidden />}
    </ChromeIconButton>
  );
}
