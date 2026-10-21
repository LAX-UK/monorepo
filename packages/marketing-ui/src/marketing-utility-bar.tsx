"use client";

import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingUtilityBarItem = {
  label: string;
  href: string;
  current?: boolean;
};

export type MarketingUtilityBarProps = {
  items: MarketingUtilityBarItem[];
  className?: string;
  linkClassName?: string;
  resolveLinkClassName?: (item: MarketingUtilityBarItem) => string | undefined;
  /** Right-aligned actions (sign-in, enquire); rendered after, and outside, the utility landmark. */
  trailing?: ReactNode;
};

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

export function MarketingUtilityBar({
  items,
  className,
  linkClassName,
  resolveLinkClassName,
  trailing,
}: MarketingUtilityBarProps) {
  const nav = (
    <nav
      aria-label="Utility"
      className={cn("flex flex-wrap items-center justify-end gap-6", className)}
    >
      {items.map((item) => {
        const itemClassName = resolveLinkClassName?.(item) ?? linkClassName;
        return isExternalHref(item.href) ? (
          <a
            key={item.href}
            href={item.href}
            className={itemClassName}
            rel="noopener noreferrer"
            aria-current={item.current ? "page" : undefined}
          >
            {item.label}
          </a>
        ) : (
          <Link
            key={item.href}
            href={item.href}
            className={itemClassName}
            aria-current={item.current ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
  if (!trailing) return nav;
  return (
    <div className="flex items-center justify-between gap-6">
      {nav}
      <div className="flex shrink-0 items-center gap-6">{trailing}</div>
    </div>
  );
}
