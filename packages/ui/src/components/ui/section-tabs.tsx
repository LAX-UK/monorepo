"use client";

import type { ReactNode } from "react";
import { cn } from "../../lib/utils.js";

export type SectionTabItem<Id extends string = string> = {
  id: Id;
  label: ReactNode;
  href: string;
  badge?: ReactNode;
  /** When set, overrides pathname matching */
  active?: boolean;
};

export type SectionTabsProps<Id extends string = string> = {
  ariaLabel: string;
  items: ReadonlyArray<SectionTabItem<Id>>;
  /** Active tab id — required when items do not set `active` */
  active?: Id;
  variant?: "underline" | "pill";
  sticky?: boolean;
  className?: string;
  scrollOnNav?: boolean;
  renderLink?: (props: {
    href: string;
    className: string;
    children: ReactNode;
    "aria-current"?: "page";
    scroll?: boolean;
  }) => ReactNode;
};

const underlineLinkClass = (isActive: boolean) =>
  cn(
    "-mb-px inline-flex min-h-[var(--tap-target-min,44px)] shrink-0 items-center gap-2 border-b-2 pb-2 font-label text-sm font-medium uppercase tracking-[var(--text-label-caps-tracking-tight,0.18em)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    isActive
      ? "border-on-surface text-on-surface"
      : "border-transparent text-on-surface-variant hover:text-on-surface",
  );

const pillLinkClass = (isActive: boolean) =>
  cn(
    "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    isActive
      ? "border-primary/35 bg-primary-container/45 text-primary shadow-sm"
      : "border-border-hairline bg-surface-container-lowest text-on-surface-variant hover:border-primary/25 hover:bg-surface-container-high hover:text-on-surface",
  );

/** Section navigation — underline (default) or pill tabs; framework-agnostic via `renderLink`. */
export function SectionTabs<Id extends string>({
  ariaLabel,
  items,
  active,
  variant = "underline",
  sticky = false,
  className,
  scrollOnNav = false,
  renderLink,
}: SectionTabsProps<Id>) {
  const navClass =
    variant === "pill"
      ? cn(
          sticky &&
            "sticky top-0 z-10 -mx-1 overflow-x-auto rounded-2xl border border-border-hairline bg-surface-container-lowest/90 px-2 py-2.5 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-surface-container-lowest/80",
          className,
        )
      : cn(
          "flex w-full flex-wrap gap-4 border-b border-border-soft sm:gap-6",
          sticky && "sticky top-0 z-10 bg-surface/95 py-2 backdrop-blur-sm",
          className,
        );

  const inner =
    variant === "pill" ? (
      <div className="flex min-w-max items-center gap-2">{renderItems()}</div>
    ) : (
      renderItems()
    );

  function renderItems() {
    return items.map((item) => {
      const isActive = item.active ?? item.id === active;
      const classNameLink =
        variant === "pill" ? pillLinkClass(isActive) : underlineLinkClass(isActive);
      const content = (
        <>
          <span>{item.label}</span>
          {item.badge !== undefined ? <span>{item.badge}</span> : null}
        </>
      );

      if (renderLink) {
        return (
          <span key={item.id} className={variant === "pill" ? "shrink-0" : undefined}>
            {renderLink({
              href: item.href,
              className: classNameLink,
              children: content,
              ...(isActive ? { "aria-current": "page" as const } : {}),
              scroll: scrollOnNav,
            })}
          </span>
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
    });
  }

  return (
    <nav aria-label={ariaLabel} className={navClass}>
      {inner}
    </nav>
  );
}
