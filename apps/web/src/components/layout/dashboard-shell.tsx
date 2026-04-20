"use client";

import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MaterialIcon } from "@/components/ui/material-icon";
import { useLogout } from "@/lib/auth/use-logout";
import type { SessionUser } from "@/lib/data/contracts";
import { breadcrumbsForPath } from "@/lib/navigation/dashboard-breadcrumbs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@auction/ui/components/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@auction/ui/components/dropdown-menu";
import { TooltipProvider } from "@auction/ui/components/tooltip";
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

export type DashboardShellSidebarProps = {
  onNavigate: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
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
  /** Collector menus link to `/dashboard/*`; admin shell omits those (admins cannot use collector dashboard). */
  accountMenu?: "collector" | "admin";
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
}: Props) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeNav = useCallback(() => setMobileNavOpen(false), []);
  const setMobileOpen = useCallback((open: boolean) => {
    setMobileNavOpen(open);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile nav when the route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const crumbs = breadcrumbsForPath(pathname, user);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-surface font-body text-on-surface">
        <CommandPaletteLazy variant="dashboard" />
        <div
          className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-outline-variant/15 bg-surface-container-lowest/95 px-3 backdrop-blur-md lg:hidden"
          role="banner"
        >
          <button
            type="button"
            className="rounded-md p-2 text-on-surface transition-colors hover:bg-surface-container-low focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-expanded={mobileNavOpen}
            aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMobileNavOpen((o) => !o)}
          >
            <MaterialIcon name={mobileNavOpen ? "close" : "menu"} />
          </button>
          <span className="min-w-0 flex-1 truncate text-center font-headline text-sm font-semibold tracking-tight text-on-surface">
            {mobileTitle}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <NotificationBell />
            <Link
              href="/"
              className="rounded-md p-2 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              aria-label="Back to gallery"
            >
              <MaterialIcon name="home" />
            </Link>
          </div>
        </div>

        <ShellContext.Provider
          value={{ onNavigate: closeNav, mobileOpen: mobileNavOpen, setMobileOpen }}
        >
          {sidebar}
        </ShellContext.Provider>

        <div className="min-h-screen flex-1 pt-14 lg:pt-0 lg:pl-64">
          <div className="hidden items-center justify-between gap-4 border-b border-outline-variant/10 px-6 py-3 lg:flex lg:px-10">
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
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <NotificationBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex max-w-[12rem] items-center gap-2 rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-1.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="truncate font-medium">{user.name}</span>
                    <MaterialIcon name="expand_more" className="shrink-0 text-base opacity-70" />
                  </button>
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
          <div id="main-content" className="px-4 py-10 md:px-12 md:py-12 lg:px-10 xl:px-16">
            {children}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
