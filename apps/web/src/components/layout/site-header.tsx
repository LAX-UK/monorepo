"use client";

import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { emptyMegaMenuSections } from "@/components/layout/header-nav-config";
import { ChromeIconButton } from "@/components/marketing/chrome-icon-button";
import { useAppSession } from "@/lib/auth/use-app-session";
import { type SiteHeaderTone, headerChromeIconClass } from "@/lib/layout/header-chrome-tone";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { useMarketingHeaderTitle } from "@/lib/marketing/marketing-header-title-context";
import { restoreMegaMenuAuthedHrefs } from "@/lib/marketing/mega-menu-href-rewrite";
import { cn } from "@auction/ui";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

function SiteHeaderShell({
  nav: navProp,
  transparentPaths,
  chromeVariant,
  searchParams,
}: SiteHeaderShellProps) {
  const { user } = useAppSession();
  const nav = useMemo(() => {
    const base = navProp ?? emptyMegaMenuSections();
    return user ? restoreMegaMenuAuthedHrefs(base) : base;
  }, [navProp, user]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const pathname = usePathname();
  const searchKey = searchParams == null ? "" : searchParams.toString();
  const headerRef = useRef<HTMLElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastHeaderHeightRef = useRef(0);
  const { title: marketingPageTitle } = useMarketingHeaderTitle();

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
      window.dispatchEvent(new Event("scroll"));
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    resizeObserverRef.current = ro;
  }, []);

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

  const headerTone: SiteHeaderTone = isTransparent ? "on-dark" : "on-light";

  return (
    <>
      <header
        ref={setHeaderNode}
        data-chrome-variant={resolvedVariant}
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
        <div className="mx-auto flex max-w-[var(--container-max,1440px)] flex-col gap-4 px-8 py-2 md:px-10 lg:gap-4 lg:px-14 lg:pt-3 lg:pb-4">
          <div className="hidden lg:block">
            <HeaderUtilityBar headerTone={headerTone} />
          </div>

          <HeaderMegaNav
            sections={nav}
            pathname={pathname}
            searchParams={searchParams}
            onOpenChange={setMegaOpen}
            headerTone={headerTone}
            logo={
              <Link
                href="/"
                className={cn("site-header-logo min-w-[76px] shrink-0 rounded-sm", FOCUS_RING)}
              >
                <LaxLogo
                  variant="header"
                  imageWidth={1089}
                  imageHeight={331}
                  surfaceTone={headerTone}
                />
              </Link>
            }
            trailing={
              <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2 lg:gap-3">
                <HeaderSearchTrigger tone={headerTone} showIcon fullBarFrom="2xl" />
                <div className="hidden lg:flex">
                  <ThemeToggle headerTone={headerTone} />
                </div>
                <HeaderAuthChip variant="notifications" headerTone={headerTone} />
                <HeaderAuthChip variant="account" headerTone={headerTone} />
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
