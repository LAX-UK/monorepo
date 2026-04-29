"use client";

import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import type { MegaMenuSection } from "@/components/layout/header-nav-config";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { SessionUser } from "@/lib/data/contracts";
import { createLocalStorageSidebarCollapsedStore } from "@/lib/preferences/preferences-store";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { usePathname } from "next/navigation";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

export type DashboardTableDensity = "comfortable" | "compact";

const TABLE_DENSITY_CONTEXT_VALUE = {
  density: "comfortable" as const satisfies DashboardTableDensity,
  setDensity: (_d: DashboardTableDensity) => {},
};

const TableDensityContext = createContext<{
  density: DashboardTableDensity;
  setDensity: (d: DashboardTableDensity) => void;
} | null>(null);

/** Table density is fixed to comfortable (density toggle removed from shell). */
export function useTableDensity(): {
  density: DashboardTableDensity;
  setDensity: (d: DashboardTableDensity) => void;
} {
  const ctx = useContext(TableDensityContext);
  if (!ctx) {
    return {
      density: "comfortable",
      setDensity: () => {},
    };
  }
  return ctx;
}

export type DashboardShellSidebarProps = {
  onNavigate: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  desktopSidebarCollapsed: boolean;
  setDesktopSidebarCollapsed: (collapsed: boolean) => void;
  toggleDesktopSidebarCollapsed: () => void;
};

const ShellContext = createContext<DashboardShellSidebarProps | null>(null);

export function useShellContext(): DashboardShellSidebarProps {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShellContext must be used inside DashboardShell");
  return ctx;
}

type Props = {
  user: SessionUser;
  nav: MegaMenuSection[];
  children: ReactNode;
  mobileTitle?: string;
  sidebar: ReactNode;
  accountMenu?: "collector" | "admin";
  /** Extra actions in desktop top bar (e.g. primary CTA) */
  pageActions?: ReactNode;
};

export function DashboardShell({
  user,
  nav,
  children,
  mobileTitle = "Dashboard",
  sidebar,
  accountMenu = "collector",
  pageActions,
}: Props) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);

  useEffect(() => {
    const store = createLocalStorageSidebarCollapsedStore();
    setDesktopSidebarCollapsed(store.getCollapsed());
  }, []);

  const toggleDesktopSidebarCollapsed = useCallback(() => {
    setDesktopSidebarCollapsed((prev) => {
      const next = !prev;
      createLocalStorageSidebarCollapsedStore().setCollapsed(next);
      return next;
    });
  }, []);

  const closeNav = useCallback(() => setMobileNavOpen(false), []);
  const setMobileOpen = useCallback((open: boolean) => {
    setMobileNavOpen(open);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile nav when the route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const sidebarWidth = desktopSidebarCollapsed ? "4.5rem" : "17rem";
  const shellTitle = accountMenu === "admin" ? "Admin workspace" : "My account";
  const shellSubtitle =
    accountMenu === "admin"
      ? "Manage platform operations using the same storefront design language."
      : "Manage bidding, profile, notifications, and selling activity.";

  return (
    <TooltipProvider delayDuration={200}>
      <TableDensityContext.Provider value={TABLE_DENSITY_CONTEXT_VALUE}>
        <div
          className="flex min-h-screen bg-surface font-body text-on-surface"
          style={{ ["--sidebar-width" as string]: sidebarWidth }}
        >
          <CommandPaletteLazy variant={accountMenu === "admin" ? "admin" : "dashboard"} />
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[60] -translate-y-[120%] rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-primary focus:translate-y-0 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
          >
            Skip to content
          </a>
          <SiteHeader user={user} nav={nav} />

          <ShellContext.Provider
            value={{
              onNavigate: closeNav,
              mobileOpen: mobileNavOpen,
              setMobileOpen,
              desktopSidebarCollapsed,
              setDesktopSidebarCollapsed,
              toggleDesktopSidebarCollapsed,
            }}
          >
            <div className="min-h-screen flex-1">
              <div className="mx-auto w-full max-w-[1440px] px-4 pb-28 pt-[calc(var(--header-height,7rem)+1rem)] md:px-8 md:pb-16 lg:px-10">
                <header className="mb-8 border-b border-outline-variant/20 pb-5">
                  <p className="font-label text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant">
                    {mobileTitle}
                  </p>
                  <h1 className="mt-2 font-headline text-2xl font-semibold tracking-tight text-on-surface md:text-3xl">
                    {shellTitle}
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{shellSubtitle}</p>
                </header>

                <div className="lg:grid lg:grid-cols-[minmax(220px,var(--sidebar-width))_minmax(0,1fr)] lg:gap-10">
                  <aside className="mb-8 lg:mb-0">{sidebar}</aside>
                  <main
                    id="main-content"
                    className="min-w-0 rounded-sm border border-outline-variant/20 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] md:p-6 lg:p-8"
                  >
                    {pageActions ? (
                      <div className="mb-4 flex flex-wrap items-center justify-end gap-2 border-b border-outline-variant/15 pb-4">
                        {pageActions}
                      </div>
                    ) : null}
                    {children}
                  </main>
                </div>
              </div>
              <SiteFooter />
            </div>
          </ShellContext.Provider>
        </div>
      </TableDensityContext.Provider>
    </TooltipProvider>
  );
}
