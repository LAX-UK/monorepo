import * as React from "react";
import { cn } from "../../lib/utils.js";

export type TocNavItem = {
  id: string;
  label: string;
};

export type TocNavProps = {
  items: readonly TocNavItem[];
  className?: string;
  /** When true, nav sticks within the viewport while scrolling */
  sticky?: boolean;
  "aria-label"?: string;
};

/**
 * Table-of-contents style anchor list for long legal / policy pages.
 */
export function TocNav({
  items,
  className,
  sticky = true,
  "aria-label": ariaLabel = "On this page",
}: TocNavProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "rounded-lg border border-outline-variant/40 bg-surface-container-low/80 p-4 backdrop-blur-sm",
        sticky && "lg:sticky lg:top-[calc(var(--header-height,114px)+1rem)]",
        className,
      )}
    >
      <p className="mb-3 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">
        Contents
      </p>
      <ol className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-on-surface-variant transition-colors hover:text-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
