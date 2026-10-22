"use client";

import { Menu } from "lucide-react";
import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "../components/ui/sheet.js";
import { SidebarInset, SidebarTrigger } from "../components/ui/sidebar.js";
import { cn } from "../lib/utils.js";
import { resolveActiveNavHref } from "./admin-nav-match.js";

export type AdminShellNavItem = {
  href: string;
  label: string;
  /** Number of records waiting for staff, shown beside the label. */
  attentionCount?: number;
};

export type AdminShellNavGroup = {
  title: string;
  items: AdminShellNavItem[];
};

export type AdminShellLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  "aria-current"?: "page";
  onClick?: () => void;
};

export type AdminShellProps = {
  productName: string;
  navGroups: AdminShellNavGroup[];
  /** Current location. Passed in so the shell works with any router and can be tested without one. */
  pathname: string;
  /** Who is signed in, and how to sign out. Shown at the foot of the navigation. */
  account: React.ReactNode;
  /** Sits in the top bar beside the menu button, e.g. breadcrumbs. */
  header?: React.ReactNode;
  /** Router-aware link (e.g. `next/link`) so navigation stays client-side; defaults to `<a>`. */
  linkComponent?: React.ComponentType<AdminShellLinkProps>;
  children: React.ReactNode;
};

const PlainLink = ({ children, ...props }: AdminShellLinkProps) => <a {...props}>{children}</a>;

const itemClass = (active: boolean) =>
  cn(
    "flex min-h-11 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    active
      ? "bg-primary-container font-medium text-on-primary-container"
      : "text-on-surface hover:bg-surface-container-high",
  );

type NavProps = Pick<AdminShellProps, "productName" | "navGroups" | "pathname" | "account"> & {
  Link: React.ComponentType<AdminShellLinkProps>;
  onNavigate?: () => void;
};

function ShellNav({ productName, navGroups, pathname, account, Link, onNavigate }: NavProps) {
  const activeHref = resolveActiveNavHref(
    pathname,
    navGroups.flatMap((group) => group.items.map((item) => item.href)),
  );
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <p className="px-3 font-headline text-lg font-semibold text-on-surface">{productName}</p>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-5">
        {navGroups.map((group) => {
          const headingId = `admin-nav-${group.title.toLowerCase().replace(/\W+/g, "-")}`;
          return (
            <div key={group.title}>
              <p
                id={headingId}
                className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant"
              >
                {group.title}
              </p>
              <ul aria-labelledby={headingId} className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = item.href === activeHref;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={itemClass(active)}
                        {...(active ? { "aria-current": "page" as const } : {})}
                        {...(onNavigate ? { onClick: onNavigate } : {})}
                      >
                        <span>{item.label}</span>
                        {item.attentionCount ? (
                          <span className="rounded-full bg-primary px-2 text-xs font-semibold text-on-primary">
                            {item.attentionCount}
                            <span className="sr-only"> need attention</span>
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-outline-variant pt-4">{account}</div>
    </div>
  );
}

/**
 * Staff console frame: a fixed sidebar from `lg` upwards and a drawer below it, with a skip link
 * and the page's single `<main>` landmark.
 */
export function AdminShell({
  productName,
  navGroups,
  pathname,
  account,
  header,
  linkComponent = PlainLink,
  children,
}: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const nav = { productName, navGroups, pathname, account, Link: linkComponent };
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        Skip to main content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-outline-variant bg-surface-container-low lg:block">
        <ShellNav {...nav} />
      </aside>
      <SidebarInset className="lg:pl-64">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b border-outline-variant bg-surface px-4 lg:px-8">
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <SidebarTrigger aria-label="Open navigation" className="size-11 lg:hidden">
                <Menu className="size-5" aria-hidden />
              </SidebarTrigger>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 max-w-[85vw] p-0">
              <SheetTitle className="sr-only">{productName} navigation</SheetTitle>
              <SheetDescription className="sr-only">Pages and sign out</SheetDescription>
              <ShellNav {...nav} onNavigate={() => setDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-headline text-base font-semibold lg:hidden">{productName}</span>
          {header ? <div className="min-w-0 flex-1">{header}</div> : null}
        </header>
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
