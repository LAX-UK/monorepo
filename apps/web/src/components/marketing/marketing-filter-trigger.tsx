"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { SlidersHorizontal } from "lucide-react";
import { forwardRef } from "react";

export type MarketingFilterTriggerProps = {
  activeCount?: number;
  className?: string;
} & React.ComponentPropsWithoutRef<"button">;

/** Compact “Filters” control for mobile marketing toolbars (pairs with MarketingFilterSheet).
 * Dashboard uses `DashboardFilterTrigger` — intentionally denser for workspace toolbars. */
export const MarketingFilterTrigger = forwardRef<HTMLButtonElement, MarketingFilterTriggerProps>(
  function MarketingFilterTrigger({ activeCount = 0, className, ...props }, ref) {
    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        className={cn(
          "inline-flex min-h-[var(--tap-target-min,44px)] shrink-0 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container-lowest px-3 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface transition-colors hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
          className,
        )}
        {...props}
      >
        <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
        <span>Filters</span>
        {activeCount > 0 ? (
          <span
            className="inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-primary px-1 font-label text-[0.6rem] font-bold leading-none text-on-primary"
            aria-label={`${activeCount} active filters`}
          >
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        ) : null}
      </Button>
    );
  },
);
