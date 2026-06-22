"use client";

import { FOCUS_RING } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type MarketingUnderlineTabItem = {
  id: string;
  label: ReactNode;
  href: string;
  active?: boolean;
  ariaCurrent?: "page" | "true" | boolean;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
  scroll?: boolean;
};

type Props = {
  tabs: readonly MarketingUnderlineTabItem[];
  ariaLabel: string;
  /** `anchor` — compact label caps (sale page); `route` — calendar primary tabs. */
  variant?: "anchor" | "route";
  className?: string;
  listClassName?: string;
};

/** Shared underline tab nav for anchor-scroll and route-based marketing tabs. */
export function MarketingUnderlineTabs({
  tabs,
  ariaLabel,
  variant = "route",
  className,
  listClassName,
}: Props) {
  const isAnchor = variant === "anchor";

  return (
    <nav aria-label={ariaLabel} className={className}>
      <div
        className={cn(
          isAnchor
            ? "mx-auto flex max-w-[var(--container-max,1440px)] gap-1 overflow-x-auto px-8 [scrollbar-width:none] md:px-10 lg:px-14"
            : "inline-flex min-w-full items-start gap-5 border-b border-outline-variant pb-0 sm:gap-8 lg:min-w-0 lg:gap-12",
          listClassName,
        )}
      >
        {tabs.map((tab) => {
          const active = Boolean(tab.active);
          const linkClass = isAnchor
            ? cn(
                "relative inline-flex min-h-11 shrink-0 items-center border-b-2 px-4 font-label text-[0.7rem] font-semibold uppercase tracking-wider transition-colors motion-reduce:transition-none",
                FOCUS_RING,
                active
                  ? "border-primary text-on-surface"
                  : "border-transparent text-on-surface-variant hover:text-on-surface",
              )
            : cn(
                "snap-start inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap py-2 font-body text-base font-semibold uppercase leading-5 text-nav-text transition-colors duration-200 ease-out sm:pb-1.5 lg:text-lg lg:leading-[21px]",
                "border-b-[1.5px] border-transparent hover:text-on-surface",
                "motion-safe:transition-[color,border-color] motion-safe:duration-200",
                "focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                active && "border-on-surface text-on-surface",
              );

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={linkClass}
              aria-current={tab.ariaCurrent ?? (active ? (isAnchor ? "true" : "page") : undefined)}
              prefetch={tab.prefetch ?? false}
              scroll={tab.scroll ?? !!isAnchor}
              {...(tab.onClick ? { onClick: tab.onClick } : {})}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
