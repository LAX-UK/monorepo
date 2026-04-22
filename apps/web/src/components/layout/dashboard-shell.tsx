"use client";

import { openCommandPalette } from "@/components/layout/command-palette-events";
import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { useLogout } from "@/lib/auth/use-logout";
import type { SessionUser } from "@/lib/data/contracts";
import { breadcrumbsForPath } from "@/lib/navigation/dashboard-breadcrumbs";
import { createLocalStorageSidebarCollapsedStore } from "@/lib/preferences/preferences-store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@auction/ui/components/breadcrumb";
import { Button } from "@auction/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { TooltipProvider } from "@auction/ui/components/tooltip";
import { ChevronDown, Home, Menu, PanelLeft, PanelLeftClose, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Fragment,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

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
  children: ReactNode;
  mobileTitle?: string;
  sidebar: ReactNode;
  accountMenu?: "collector" | "admin";
  /** Extra actions in desktop top bar (e.g. primary CTA) */
  pageActions?: ReactNode;
};

function AdminAccountMenuItems() {
  const { logout, pending } = useLogout();
  return (
    <>
      <DropdownMenuItem asChild>
        <Link href="/">Gallery</Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        disabled={pending}
        onSelect={(e) => {
          e.preventDefault();
          void logout();
        }}
      >
        Sign out
      </DropdownMenuItem>
    </>
  );
}

export function DashboardShell({
  user,
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

  const paletteVariant = accountMenu === "admin" ? "admin" : "dashboard";

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

  const crumbs = breadcrumbsForPath(pathname, user);
  const sidebarWidth = desktopSidebarCollapsed ? "4.5rem" : "16rem";

  const isMac =
    typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);

  return (
    <TooltipProvider delayDuration={200}>
      <TableDensityContext.Provider value={TABLE_DENSITY_CONTEXT_VALUE}>
        <div
          className="flex min-h-screen bg-surface font-body text-on-surface"
          style={{ ["--sidebar-width" as string]: sidebarWidth }}
        >
          <a
            href="#main-content"
            className="fixed left-4 top-4 z-[60] -translate-y-[120%] rounded-md bg-primary px-4 py-2 font-label text-xs font-bold uppercase tracking-widest text-on-primary focus:translate-y-0 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-primary"
          >
            Skip to content
          </a>
          <CommandPaletteLazy variant={paletteVariant} />
          <div
            className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-outline-variant/15 bg-surface-container-lowest/95 px-3 backdrop-blur-md lg:hidden"
            role="banner"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-on-surface hover:bg-surface-container-low"
              aria-expanded={mobileNavOpen}
              aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <X aria-hidden /> : <Menu aria-hidden />}
            </Button>
            <span className="min-w-0 flex-1 truncate text-center font-headline text-sm font-semibold tracking-tight text-on-surface">
              {mobileTitle}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-secondary hover:bg-surface-container-low hover:text-primary"
                aria-label="Open quick search"
                onClick={openCommandPalette}
              >
                <Search aria-hidden />
              </Button>
              <NotificationBell />
              <Link
                href="/"
                className="rounded-md p-2 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                aria-label="Back to gallery"
              >
                <Home aria-hidden />
              </Link>
            </div>
          </div>

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
            {sidebar}
          </ShellContext.Provider>

          <div className="min-h-screen flex-1 pt-14 lg:pt-0 lg:pl-[var(--sidebar-width)]">
            <div className="hidden items-center justify-between gap-4 border-b border-outline-variant/10 px-6 py-3 lg:flex lg:px-10">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="hidden shrink-0 border-outline-variant/20 bg-surface-container-low text-on-surface hover:bg-surface-container-high lg:inline-flex"
                  aria-label={desktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-pressed={desktopSidebarCollapsed}
                  onClick={toggleDesktopSidebarCollapsed}
                >
                  {desktopSidebarCollapsed ? (
                    <PanelLeft aria-hidden />
                  ) : (
                    <PanelLeftClose aria-hidden />
                  )}
                </Button>
                <Breadcrumb>
                  <BreadcrumbList>
                    {crumbs.map((c, i) => (
                      <Fragment key={c.href}>
                        {i > 0 ? (
                          <BreadcrumbSeparator>
                            <span className="text-on-surface-variant/50" aria-hidden>
                              /
                            </span>
                          </BreadcrumbSeparator>
                        ) : null}
                        <BreadcrumbItem>
                          {i === crumbs.length - 1 ? (
                            <BreadcrumbPage className="font-medium text-on-surface">
                              {c.label}
                            </BreadcrumbPage>
                          ) : (
                            <BreadcrumbLink asChild>
                              <Link href={c.href} className="hover:text-primary">
                                {c.label}
                              </Link>
                            </BreadcrumbLink>
                          )}
                        </BreadcrumbItem>
                      </Fragment>
                    ))}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                {pageActions ? (
                  <div className="mr-1 flex max-w-md flex-wrap items-center justify-end gap-2">
                    {pageActions}
                  </div>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openCommandPalette}
                  className="h-auto gap-2 rounded-full border-outline-variant/20 bg-surface-container-low px-3 py-1.5 font-label text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                >
                  <Search className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Search</span>
                  <kbd className="hidden rounded border border-outline-variant/30 bg-surface-container-high px-1.5 py-0.5 font-mono text-[10px] sm:inline">
                    {isMac ? "⌘" : "Ctrl"}+K
                  </kbd>
                </Button>
                <ThemeToggle />
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto max-w-[12rem] justify-start gap-2 border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-left text-sm text-on-surface hover:bg-surface-container-high"
                    >
                      <span className="truncate font-medium">{user.name}</span>
                      <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="truncate font-normal text-on-surface-variant">
                      {user.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {accountMenu === "admin" ? (
                      <AdminAccountMenuItems />
                    ) : (
                      <>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/settings/profile">Profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/dashboard/settings/notifications">Alert settings</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                          <Link href="/">Gallery</Link>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div
              id="main-content"
              className="mx-auto w-full max-w-[var(--container-inner,1376px)] px-4 py-10 md:px-8 md:py-12 lg:px-10 xl:px-12"
            >
              {children}
            </div>
          </div>
        </div>
      </TableDensityContext.Provider>
    </TooltipProvider>
  );
}
