"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";

type Props = {
  user: SessionUser;
  children: ReactNode;
};

export function DashboardShell({ user, children }: Props) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const closeNav = useCallback(() => setMobileNavOpen(false), []);

  useEffect(() => {
    closeNav();
  }, [pathname, closeNav]);

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
      <div
        className="fixed inset-x-0 top-0 z-30 flex h-14 items-center justify-between border-b border-outline-variant/15 bg-surface-container-lowest/95 px-4 backdrop-blur-md lg:hidden"
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
        <span className="truncate font-headline text-sm font-semibold tracking-tight text-on-surface">
          Dashboard
        </span>
        <Link
          href="/"
          className="rounded-md p-2 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-label="Back to gallery"
        >
          <MaterialIcon name="home" />
        </Link>
      </div>

      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close navigation overlay"
          onClick={closeNav}
        />
      ) : null}

      <DashboardSidebar user={user} onNavigate={closeNav} mobileOpen={mobileNavOpen} />

      <div className="min-h-screen flex-1 pt-14 lg:pt-0 lg:pl-64">
        <div id="main-content" className="px-4 py-10 md:px-12 md:py-12 lg:px-20">
          {children}
        </div>
      </div>
    </div>
  );
}
