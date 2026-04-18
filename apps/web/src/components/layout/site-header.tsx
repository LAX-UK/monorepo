"use client";

import { LaxLogo } from "@/components/layout/lax-logo";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { MaterialIcon } from "@/components/ui/material-icon";
import type { SessionUser } from "@/lib/data/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";

const primaryNav = [
  { href: "/", label: "Upcoming Auctions" },
  { href: "/archive", label: "Past Auctions" },
  { href: "/artist/featured", label: "Artists" },
];

const utilityNav = [
  { href: "/terms", label: "FAQs" },
  { href: "/contact", label: "Contact us" },
  { href: "/about", label: "About us" },
];

function navItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/artist/featured") return pathname.startsWith("/artist");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader({ user }: { user: SessionUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const pathname = usePathname();

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    void pathname;
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  const linkTop =
    "font-label text-sm font-medium uppercase leading-[21px] text-nav-text transition-colors hover:text-brand-900";

  return (
    <header className="fixed top-0 z-50 w-full border-b border-nav-border bg-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-6 py-3 md:px-10">
        <div className="flex flex-wrap items-center justify-end gap-6">
          {utilityNav.map((item) => (
            <Link key={item.label} href={item.href} className={linkTop}>
              {item.label}
            </Link>
          ))}
          {user ? (
            <Link href="/dashboard" className={linkTop}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={linkTop}>
                Log in
              </Link>
              <Link href="/register" className={linkTop}>
                Register
              </Link>
            </>
          )}
          <span className={`inline-flex items-center gap-2 ${linkTop}`}>
            English
            <MaterialIcon name="expand_more" className="text-base!" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Link
            href="/"
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
          >
            <LaxLogo variant="header" />
          </Link>

          <nav className="hidden items-center justify-center gap-9 lg:flex" aria-label="Primary">
            {primaryNav.map((item) => {
              const active = navItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-label text-sm font-medium uppercase leading-[21px] transition-colors ${
                    active ? "text-brand-900" : "text-nav-text hover:text-brand-900"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:max-w-[320px] lg:flex-none">
            <form
              action="/search"
              method="get"
              className="hidden min-w-0 flex-1 items-center border-b border-brand-200 md:flex lg:w-[231px] lg:flex-none"
            >
              <label htmlFor="site-header-search" className="sr-only">
                Search
              </label>
              <input
                id="site-header-search"
                name="q"
                type="search"
                placeholder="Search"
                className="min-w-0 flex-1 bg-transparent py-2 font-label text-sm font-medium leading-[21px] text-brand-900 placeholder:text-brand-200 focus:outline-none"
                autoComplete="off"
              />
              <button
                type="submit"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-brand-900 hover:bg-page-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold"
                aria-label="Submit search"
              >
                <MaterialIcon name="search" />
              </button>
            </form>
            <ThemeToggle />
            <NotificationBell />
            <button
              type="button"
              className="rounded-md p-1 text-brand-800 transition-colors hover:bg-page-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-gold lg:hidden"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <MaterialIcon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id={menuId}
          className="border-t border-nav-border bg-white px-6 py-6 lg:hidden"
          aria-label="Mobile primary"
        >
          <ul className="flex flex-col gap-4">
            <li>
              <form action="/search" method="get" className="flex gap-2 border-b border-brand-200 pb-3">
                <input
                  name="q"
                  type="search"
                  placeholder="Search"
                  className="min-w-0 flex-1 bg-transparent font-label text-sm uppercase text-brand-900 placeholder:text-brand-200 focus:outline-none"
                />
                <button
                  type="submit"
                  className="font-label text-xs font-semibold uppercase text-brand-900"
                >
                  Go
                </button>
              </form>
            </li>
            {primaryNav.map((item) => {
              const active = navItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block py-2 font-label text-sm font-medium uppercase tracking-wide ${
                      active ? "text-brand-900" : "text-nav-text"
                    }`}
                    aria-current={active ? "page" : undefined}
                    onClick={closeMenu}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {utilityNav.map((item) => (
              <li key={`m-${item.label}`}>
                <Link
                  href={item.href}
                  className="block py-2 font-label text-sm font-medium uppercase text-brand-900"
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-3 py-2">
              <span className="font-label text-xs font-semibold uppercase text-brand-400">
                Theme
              </span>
              <ThemeToggle />
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
