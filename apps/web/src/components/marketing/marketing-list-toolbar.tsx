"use client";

import { MARKETING_CATALOG_GUTTER } from "@/lib/marketing/chrome";
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
  /** When false, trailing controls stay on the primary row on mobile. */
  stackTrailingOnMobile?: boolean;
  className?: string;
};

/** Sticky glass toolbar for marketing catalogue pages. */
export function MarketingListToolbar({
  countLabel,
  filters,
  sort,
  trailing,
  mobileFilterTrigger,
  stackTrailingOnMobile = true,
  className,
}: MarketingListToolbarProps) {
  const stackTrailing = stackTrailingOnMobile && Boolean(mobileFilterTrigger && trailing);
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
          "sticky top-[var(--header-height,4rem)] z-30 border-b border-border-hairline bg-surface/85 backdrop-blur-md motion-safe:transition-shadow motion-safe:duration-200",
          scrolled &&
            "shadow-[0_4px_12px_-12px_rgba(0,0,0,0.15)] dark:shadow-[0_4px_12px_-12px_rgba(0,0,0,0.35)]",
          className,
        )}
      >
        <div
          className={cn(
            "mx-auto max-w-[var(--container-max,1440px)] py-2 md:py-3",
            MARKETING_CATALOG_GUTTER,
          )}
        >
          <div className="flex flex-col gap-2 md:gap-0">
            <div className="flex min-w-0 h-12 min-h-12 items-center gap-2 md:h-14 md:min-h-14 md:gap-3">
              {countLabel ? (
                <p className="max-w-[6rem] shrink-0 truncate font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant tabular-nums sm:max-w-[10rem]">
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
              <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
                {sort ? <div className="shrink-0">{sort}</div> : null}
                {trailing ? (
                  <div
                    className={cn(
                      "flex shrink-0 items-center gap-2 md:gap-3",
                      stackTrailing && "hidden md:flex",
                    )}
                  >
                    {trailing}
                  </div>
                ) : null}
              </div>
            </div>
            {stackTrailing ? (
              <div
                data-testid="mobile-trailing-row"
                className="flex items-center justify-end gap-2 border-t border-border-hairline pt-2 md:hidden"
              >
                {trailing}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
