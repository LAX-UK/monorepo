"use client";

import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardSectionTab = {
  href: string;
  label: string;
  badge?: string | number;
  isActive?: boolean;
};

type DashboardSectionTabsProps = {
  items: readonly DashboardSectionTab[];
  ariaLabel: string;
  className?: string;
};

function isTabActive(pathname: string, item: DashboardSectionTab) {
  if (item.isActive !== undefined) {
    return item.isActive;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function DashboardSectionTabs({ items, ariaLabel, className }: DashboardSectionTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "sticky top-0 z-10 -mx-1 overflow-x-auto border-b border-outline-variant/15 bg-background/90 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75",
        className,
      )}
    >
      <div className="flex min-w-max items-center gap-2">
        {items.map((item) => {
          const active = isTabActive(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 font-label text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
                active
                  ? "border-primary/35 bg-primary-container/45 text-primary shadow-sm"
                  : "border-outline-variant/15 bg-surface-container-lowest text-on-surface-variant hover:border-primary/25 hover:bg-surface-container-low hover:text-on-surface",
              )}
            >
              <span>{item.label}</span>
              {item.badge !== undefined ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] tracking-normal",
                    active
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-high text-on-surface-variant",
                  )}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
