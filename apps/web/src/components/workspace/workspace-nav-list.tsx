"use client";

import type { AppShellNavItem } from "@/components/layout/app-shell-nav-item";
import { type ClientNavSection, navItemMatches } from "@/lib/navigation/client-nav-model";
import { cn } from "@auction/ui";
import { Count } from "@auction/ui/lax";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/** What each entry carries beside its name: work waiting (ink) or unread (neutral). */
export type WorkspaceNavCounts = {
  /** Needs-you counts by entry id, already without zeros. */
  needsYou: Readonly<Record<string, number>>;
  /** Unread notifications, shown on Notifications. */
  unread: number;
};

/**
 * One menu entry: 36px, a 16px icon at 1.75 stroke and a 14px name. The current page has a 3px
 * navy bar on its left edge and a tint, and `aria-current`. Work waiting shows as an ink count;
 * a count of 0 is never shown.
 */
function NavEntry({
  item,
  active,
  count,
  countTone,
  onNavigate,
}: {
  item: AppShellNavItem;
  active: boolean;
  count: number;
  countTone: "attention" | "neutral";
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const className = cn(
    "lax-focus relative flex min-h-9 items-center gap-3 rounded-lax-control px-3 text-lax-14 transition-colors duration-150",
    "max-lg:min-h-11",
    active
      ? "bg-lax-selected font-medium text-lax-fg before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-product-accent dark:before:bg-lax-fg"
      : "text-lax-fg hover:bg-lax-hover",
  );
  const content = (
    <>
      <Icon aria-hidden className="size-4 shrink-0 text-lax-muted" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {count > 0 ? (
        <Count
          value={count}
          tone={countTone}
          label={countTone === "attention" ? "need you" : "unread"}
        />
      ) : null}
      {item.external ? (
        <ArrowUpRight aria-hidden className="size-3.5 shrink-0 text-lax-muted" />
      ) : null}
    </>
  );
  if (item.external) {
    return (
      <a href={item.href} className={className} {...(onNavigate ? { onClick: onNavigate } : {})}>
        {content}
        <span className="sr-only"> (opens LAX Account)</span>
      </a>
    );
  }
  return (
    <Link
      href={item.href}
      prefetch
      className={className}
      {...(onNavigate ? { onClick: onNavigate } : {})}
      {...(active ? { "aria-current": "page" as const } : {})}
    >
      {content}
    </Link>
  );
}

/** The menu's sections in order: a 12px sentence-case heading, then the entries. */
export function WorkspaceNavList({
  sections,
  pathname,
  counts,
  onNavigate,
  className,
}: {
  sections: readonly ClientNavSection[];
  pathname: string;
  counts: WorkspaceNavCounts;
  onNavigate?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {sections.map((section) => (
        <div key={section.id}>
          {section.label ? (
            <p className="px-3 pb-1 text-lax-12 font-medium text-lax-muted" aria-hidden>
              {section.label}
            </p>
          ) : null}
          <ul
            className="flex flex-col gap-0.5"
            {...(section.label ? { "aria-label": section.label } : {})}
          >
            {section.items.map((item) => {
              const unread = item.id === "notifications" ? counts.unread : 0;
              const needs = counts.needsYou[item.id] ?? 0;
              return (
                <li key={item.id}>
                  <NavEntry
                    item={item}
                    active={!item.external && navItemMatches(item, pathname)}
                    count={needs || unread}
                    countTone={needs ? "attention" : "neutral"}
                    {...(onNavigate ? { onNavigate } : {})}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
