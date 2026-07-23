"use client";

import { cn } from "@auction/ui";
import Link from "next/link";

import type { CatalogSegmentItem, CatalogSegmentNavProps } from "@/lib/admin/catalog/types";

export type { CatalogSegmentItem, CatalogSegmentNavProps };

type Props = CatalogSegmentNavProps;

/** GET-based lens control — underlined tab row with count badges. */
export function CatalogSegmentNav({ items, activeId, "aria-label": ariaLabel, className }: Props) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn(
        "flex max-w-full items-center gap-6 overflow-x-auto border-b border-shell-stroke scrollbar-thin",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.id === activeId;
        const content = (
          <>
            <span>{item.label}</span>
            {item.badge != null && item.badge > 0 ? (
              <span
                className={cn(
                  "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 font-label text-[10px] font-semibold tabular-nums",
                  selected
                    ? "bg-secondary text-on-secondary"
                    : "bg-surface-container-high text-on-surface-variant",
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
              className="pointer-events-none inline-flex min-h-11 items-center gap-2 border-b-2 border-transparent px-1 py-2 font-body text-base font-normal normal-case tracking-normal text-on-surface-variant opacity-50"
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
              "inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-1 py-2 font-body text-base font-normal normal-case tracking-normal transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              selected
                ? "border-secondary text-secondary"
                : "border-transparent text-on-surface-variant hover:border-shell-stroke hover:text-on-surface",
            )}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
