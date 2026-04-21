import * as React from "react";
import { cn } from "../../lib/utils.js";

export type SectionNavItem = {
  href: string;
  label: string;
  /** When true, link is highlighted */
  active?: boolean;
};

export type SectionNavProps = {
  items: readonly SectionNavItem[];
  className?: string;
  /** Accessible name for the nav landmark */
  "aria-label"?: string;
};

export function SectionNav({ items, className, "aria-label": ariaLabel = "Section" }: SectionNavProps) {
  return (
    <nav className={cn("space-y-1", className)} aria-label={ariaLabel}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "block rounded-md border-l-4 px-3 py-2.5 font-label text-xs font-medium uppercase tracking-widest transition-colors",
            item.active
              ? "border-primary bg-surface-container-low text-on-surface"
              : "border-transparent text-on-surface-variant hover:bg-surface-container-low/80 hover:text-on-surface",
          )}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
