"use client";

import { policyRoutes } from "@/components/marketing/policy-routes";
import { FOCUS_RING, MARKETING_CATALOG_GUTTER } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PolicyHubLayout({ children }: Props) {
  const pathname = usePathname();

  return (
    <main id="main-content" className="bg-page-bg pt-[var(--header-height)] dark:bg-background">
      <nav
        aria-label="Policy pages"
        className={cn(MARKETING_CATALOG_GUTTER, "border-b border-outline-variant/40 pt-6")}
      >
        <div className="no-scrollbar mx-auto flex max-w-[var(--container-max,1440px)] snap-x gap-0 overflow-x-auto">
          {policyRoutes.map((route) => {
            const active = isActive(pathname, route.href);
            return (
              <Link
                key={route.href}
                href={route.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "snap-start whitespace-nowrap rounded-sm border-b-2 border-transparent px-5 py-3 font-label text-xs font-semibold uppercase tracking-[0.1em] text-brand-300 transition-colors hover:text-on-surface",
                  FOCUS_RING,
                  active && "border-on-surface text-on-surface",
                )}
              >
                {route.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="grid min-h-[60vh] grid-cols-1 md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-outline-variant/40 px-6 py-10 md:block">
          <nav
            aria-label="Policy sections"
            className="sticky top-[calc(var(--header-height)+2rem)] flex flex-col gap-1"
          >
            {policyRoutes.map((route) => {
              const active = isActive(pathname, route.href);
              return (
                <Link
                  key={route.href}
                  href={route.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 font-body text-sm font-medium text-brand-300 transition-colors hover:bg-surface-container-low hover:text-on-surface",
                    FOCUS_RING,
                    active &&
                      "rounded-l-none border-l-2 border-primary bg-surface-container-low font-semibold text-on-surface",
                  )}
                >
                  {route.sidebarLabel}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
