"use client";

import { cn } from "@auction/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

export type MarketingListToolbarProps = {
  /** Result count or context line (e.g. "24 lots"). */
  countLabel?: string;
  /** Desktop-only inline filters (`hidden` below `md`). */
  filters?: ReactNode;
  sort?: ReactNode;
  /** View switcher, copy link, etc. */
  trailing?: ReactNode;
  /** Mobile-only filter sheet trigger (`md:hidden`). */
  mobileFilterTrigger?: ReactNode;
  className?: string;
};

/** Sticky glass toolbar for marketing catalogue pages. */
export function MarketingListToolbar({
  countLabel,
  filters,
  sort,
  trailing,
  mobileFilterTrigger,
  className,
}: MarketingListToolbarProps) {
  const hideFiltersOnMobile = Boolean(mobileFilterTrigger);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setScrolled(!entry.isIntersecting);
      },
      { root: null, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        ref={sentinelRef}
        className="pointer-events-none h-px w-full max-w-[var(--container-max,1440px)]"
        aria-hidden
      />
      <div
        data-scrolled={scrolled ? "true" : undefined}
        className={cn(
          "sticky top-[var(--header-height,4rem)] z-30 border-b border-outline-variant/15 bg-surface/85 backdrop-blur-md motion-safe:transition-shadow motion-safe:duration-200",
          scrolled &&
            "shadow-[0_4px_12px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_12px_-12px_rgba(0,0,0,0.35)]",
          className,
        )}
      >
        <div className="mx-auto max-w-[var(--container-max,1440px)] px-4 py-2 md:px-8 md:py-3">
          <div className="flex h-12 min-h-12 items-center gap-2 overflow-hidden md:h-14 md:min-h-14 md:gap-3">
            {countLabel ? (
              <p className="max-w-[7.5rem] shrink-0 truncate font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-widest text-on-surface-variant tabular-nums sm:max-w-[10rem]">
                {countLabel}
              </p>
            ) : null}
            {mobileFilterTrigger ? (
              <div className="shrink-0 md:hidden">{mobileFilterTrigger}</div>
            ) : null}
            {filters ? (
              <div
                className={cn(
                  "min-w-0 flex-1 md:items-center",
                  hideFiltersOnMobile ? "hidden md:flex" : "flex",
                )}
              >
                {filters}
              </div>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-2">
              {sort ? <div className="shrink-0">{sort}</div> : null}
              {trailing ? (
                <div className="flex shrink-0 items-center gap-2 md:gap-3">{trailing}</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
