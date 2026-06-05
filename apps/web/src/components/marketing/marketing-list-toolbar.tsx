"use client";

import { MarketingToolbarRow } from "@/components/marketing/marketing-toolbar-row";
import { MARKETING_CATALOG_GUTTER } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";

export type MarketingListToolbarProps = {
  /** Result count or context line (e.g. "24 lots"). */
  countLabel?: string;
  /** Desktop-only inline filters (`hidden` below `lg`). */
  filters?: ReactNode;
  sort?: ReactNode;
  /** View switcher, copy link, etc. */
  trailing?: ReactNode;
  /** Mobile/tablet filter sheet trigger (`lg:hidden`). */
  mobileFilterTrigger?: ReactNode;
  /** When true, trailing controls move to a second row on mobile (use sparingly). */
  stackTrailingOnMobile?: boolean;
  /** Full-width row below the primary toolbar (e.g. archive year + medium chips). */
  secondaryRow?: ReactNode;
  /** Full-width removable active filter chips inside the sticky shell. */
  activeFiltersRow?: ReactNode;
  className?: string;
};

/** Sticky glass toolbar for marketing catalogue pages. */
export function MarketingListToolbar({
  countLabel,
  filters,
  sort,
  trailing,
  mobileFilterTrigger,
  stackTrailingOnMobile = false,
  secondaryRow,
  activeFiltersRow,
  className,
}: MarketingListToolbarProps) {
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
          <MarketingToolbarRow
            {...(countLabel ? { countLabel } : {})}
            {...(filters ? { filters } : {})}
            {...(sort ? { sort } : {})}
            {...(trailing ? { trailing } : {})}
            {...(mobileFilterTrigger ? { mobileFilterTrigger } : {})}
            stackTrailingOnMobile={stackTrailingOnMobile}
            {...(secondaryRow ? { secondaryRow } : {})}
            {...(activeFiltersRow ? { activeFiltersRow } : {})}
          />
        </div>
      </div>
    </>
  );
}
