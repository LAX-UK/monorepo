"use client";

import { cn } from "@auction/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

export type MarketingListToolbarProps = {
  /** Result count or context line (e.g. "24 lots"). */
  countLabel?: string;
  filters?: ReactNode;
  sort?: ReactNode;
  /** View switcher, copy link, etc. */
  trailing?: ReactNode;
  /** Optional mobile-only slot (e.g. filter sheet trigger + sheet). */
  mobileExtras?: ReactNode;
  className?: string;
};

/** Sticky glass toolbar for marketing catalogue pages. */
export function MarketingListToolbar({
  countLabel,
  filters,
  sort,
  trailing,
  mobileExtras,
  className,
}: MarketingListToolbarProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
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
        <div className="mx-auto max-w-[var(--container-max,1440px)] px-4 py-3 md:px-8">
          {mobileExtras ? <div className="mb-3 flex md:hidden">{mobileExtras}</div> : null}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:gap-y-3">
            {countLabel ? (
              <p className="min-w-0 max-w-full truncate font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-widest text-on-surface-variant tabular-nums sm:max-w-[260px]">
                {countLabel}
              </p>
            ) : null}
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{filters}</div>
            <div className="flex flex-wrap items-center gap-2">{sort}</div>
            {trailing ? (
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:ml-auto sm:flex-none sm:gap-3">
                {trailing}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
