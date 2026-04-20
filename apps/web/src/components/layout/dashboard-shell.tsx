"use client";

import { CommandPaletteLazy } from "@/components/layout/command-palette-lazy";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";

export type DashboardShellSidebarProps = {
  onNavigate: () => void;
  mobileOpen: boolean;
};

/** Context for sidebar to access shell state. */
const ShellContext = createContext<DashboardShellSidebarProps | null>(null);

export function useShellContext(): DashboardShellSidebarProps {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShellContext must be used inside DashboardShell");
  return ctx;
}

type Props = {
  user: SessionUser;
  children: ReactNode;
  /** Mobile header label (e.g. "Dashboard" or "Admin"). */
  mobileTitle?: string;
  /** Sidebar component (rendered inside shell context). */
  sidebar: ReactNode;
};

export function DashboardShell({ user, children, mobileTitle = "Dashboard", sidebar }: Props) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeNav = useCallback(() => setMobileNavOpen(false), []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: close mobile nav when the route changes
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeNav();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, closeNav]);

  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface">
      <CommandPaletteLazy variant="dashboard" />
      <div
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-outline-variant/15 bg-surface-container-lowest/95 px-4 backdrop-blur-md lg:hidden"
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

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={closeNav}
        />
      ) : null}

      <ShellContext.Provider value={{ onNavigate: closeNav, mobileOpen: mobileNavOpen }}>
        {sidebar}
      </ShellContext.Provider>

      <div className="min-h-screen flex-1 pt-14 lg:pt-0 lg:pl-64">
        <div className="hidden justify-end border-b border-outline-variant/10 px-4 py-3 lg:flex lg:px-20">
          <NotificationBell />
        </div>
        <div id="main-content" className="px-4 py-10 md:px-12 md:py-12 lg:px-20">
          {children}
        </div>
      </div>
    </div>
  );
}
