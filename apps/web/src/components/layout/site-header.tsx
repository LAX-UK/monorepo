"use client";

import { NotificationBell } from "@/components/layout/notification-bell";
import { MaterialIcon } from "@/components/ui/material-icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

const nav = [
  { href: "/", label: "Upcoming Auctions" },
  { href: "/archive", label: "Past Auctions" },
  { href: "/artist/featured", label: "Artists" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  return (
    <header className="fixed top-0 z-50 w-full border-b border-outline-variant/10 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1920px] items-center justify-between px-6 py-5 md:px-20">
        <Link
          href="/"
          className="font-headline text-xl font-bold tracking-tighter text-on-surface md:text-2xl"
        >
          The Digital Curator
        </Link>
        <nav className="hidden items-center gap-12 lg:flex" aria-label="Primary">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-secondary transition-colors hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 md:gap-8">
          <Link
            href="/search"
            className="rounded-md p-1 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Search lots"
          >
            <MaterialIcon name="search" />
          </Link>
          <NotificationBell />
          <Link
            href="/dashboard"
            className="rounded-md p-1 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            aria-label="Account and dashboard"
          >
            <MaterialIcon name="person" />
          </Link>
          <button
            type="button"
            className="rounded-md p-1 text-secondary transition-colors hover:bg-surface-container-low hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MaterialIcon name={menuOpen ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav
          id={menuId}
          className="border-t border-outline-variant/10 bg-surface px-6 py-6 lg:hidden"
          aria-label="Mobile primary"
        >
          <ul className="flex flex-col gap-4">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block py-2 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-on-surface transition-colors hover:text-primary"
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/search"
                className="block py-2 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-primary"
                onClick={closeMenu}
              >
                Search
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard"
                className="block py-2 font-label text-[11px] font-semibold uppercase tracking-[0.2em] text-primary"
                onClick={closeMenu}
              >
                Dashboard
              </Link>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
