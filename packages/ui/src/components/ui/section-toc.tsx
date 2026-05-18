"use client";

import React, { type ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export type SectionTocItem<Id extends string = string> = {
  id: Id;
  label: string;
  href: string;
  badge?: ReactNode;
};

export type SectionTocProps<Id extends string = string> = {
  ariaLabel: string;
  active: Id;
  items: ReadonlyArray<SectionTocItem<Id>>;
  className?: string;
  scrollOnNav?: boolean;
  /** Optional link renderer (e.g. Next.js Link) */
  renderLink?: (props: {
    href: string;
    className: string;
    children: ReactNode;
    "aria-current"?: "page";
    scroll?: boolean;
  }) => ReactNode;
};

const linkClass = (isActive: boolean) =>
  cn(
    "-mb-px inline-flex min-h-[var(--tap-target-min,44px)] items-center gap-2 border-b-2 pb-2 font-label text-sm font-medium uppercase tracking-[var(--text-label-caps-tracking-tight,0.18em)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    isActive
      ? "border-on-surface text-on-surface"
      : "border-transparent text-on-surface-variant hover:text-on-surface",
  );

/** Horizontal underline tab nav — shell-agnostic; pass `renderLink` for framework links. */
export function SectionToc<Id extends string>({
  ariaLabel,
  active,
  items,
  className,
  scrollOnNav = false,
  renderLink,
}: SectionTocProps<Id>) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex w-full flex-wrap gap-4 border-b border-border-soft sm:gap-6", className)}
    >
      {items.map((item) => {
        const isActive = item.id === active;
        const classNameLink = linkClass(isActive);
        const content = (
          <>
            <span>{item.label}</span>
            {item.badge !== undefined ? <span>{item.badge}</span> : null}
          </>
        );

        if (renderLink) {
          return (
            <React.Fragment key={item.id}>
              {renderLink({
                href: item.href,
                className: classNameLink,
                children: content,
                ...(isActive ? { "aria-current": "page" as const } : {}),
                scroll: scrollOnNav,
              })}
            </React.Fragment>
          );
        }

        return (
          <a
            key={item.id}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={classNameLink}
          >
            {content}
          </a>
        );
      })}
    </nav>
  );
}
