"use client";

import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export type CatalogDetailTabSpec = {
  id: string;
  label: ReactNode;
  href: string;
};

type Props = {
  tabs: readonly CatalogDetailTabSpec[];
  resolveActiveTab: (pathname: string) => string;
  "aria-label": string;
};

export function CatalogDetailTabNav({ tabs, resolveActiveTab, "aria-label": ariaLabel }: Props) {
  const pathname = usePathname();
  const active = resolveActiveTab(pathname);

  return (
    <nav aria-label={ariaLabel} className="mb-6 border-b border-border-hairline">
      <ul
        className={cn(
          "flex h-auto w-full min-w-0 justify-start gap-1 overflow-x-auto p-0",
          "snap-x snap-mandatory scrollbar-thin",
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id} className="shrink-0 snap-start">
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center border-b-2 px-3 py-2.5",
                  "font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)]",
                  isActive
                    ? "border-primary text-on-surface"
                    : "border-transparent text-on-surface-variant hover:text-on-surface",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
