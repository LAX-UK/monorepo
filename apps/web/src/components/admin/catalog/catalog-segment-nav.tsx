"use client";

import { cn } from "@auction/ui";
import Link from "next/link";

export type CatalogSegmentItem = {
  id: string;
  label: string;
  href: string;
  badge?: number;
  disabled?: boolean;
};

type Props = {
  items: readonly CatalogSegmentItem[];
  activeId: string;
  "aria-label": string;
  className?: string;
};

/** GET-based lens control — link segments styled like SegmentToggle. */
export function CatalogSegmentNav({ items, activeId, "aria-label": ariaLabel, className }: Props) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-outline-variant/40 bg-surface-container-low p-1 scrollbar-thin",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === activeId;
        const content = (
          <>
            {item.label}
            {item.badge != null && item.badge > 0 ? (
              <span
                className={cn(
                  "ms-1.5 inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1 py-0.5 font-mono text-[10px] tabular-nums",
                  selected
                    ? "bg-on-primary/20 text-on-primary"
                    : "bg-surface-container-high text-on-surface",
                )}
              >
                {item.badge > 99 ? "99+" : item.badge}
              </span>
            ) : null}
          </>
        );
        if (item.disabled) {
          return (
            <span
              key={item.id}
              aria-disabled="true"
              className="pointer-events-none inline-flex min-h-11 items-center rounded-full px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant opacity-50"
            >
              {content}
            </span>
          );
        }
        return (
          <Link
            key={item.id}
            href={item.href}
            scroll={false}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-1.5 font-label text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
              selected
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
