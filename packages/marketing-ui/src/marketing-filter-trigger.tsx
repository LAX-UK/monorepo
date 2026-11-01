"use client";

import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { SlidersHorizontal } from "lucide-react";
import { forwardRef } from "react";

export type MarketingFilterTriggerProps = {
  activeCount?: number;
  /** Visible text; "Filters" by default, "Filter and sort" where the sheet also sorts. */
  label?: string;
  className?: string;
} & React.ComponentPropsWithoutRef<"button">;

/** Compact “Filters” control for mobile marketing toolbars (pairs with MarketingFilterSheet). */
export const MarketingFilterTrigger = forwardRef<HTMLButtonElement, MarketingFilterTriggerProps>(
  function MarketingFilterTrigger(
    { activeCount = 0, label = "Filters", className, ...props },
    ref,
  ) {
    return (
      <Button
        ref={ref}
        type="button"
        variant="ghost"
        className={cn(
          "inline-flex min-h-[var(--tap-target-min,44px)] shrink-0 items-center gap-1.5 rounded-full border border-outline-variant/50 bg-surface-container-lowest px-3 font-label text-xs font-medium text-on-surface transition-colors hover:border-link/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          className,
        )}
        {...props}
      >
        <SlidersHorizontal className="size-3.5 shrink-0" aria-hidden />
        <span>{label}</span>
        {activeCount > 0 ? (
          <span
            className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 font-label text-xs font-semibold leading-none text-on-primary"
            aria-label={`${activeCount} active filters`}
          >
            {activeCount > 9 ? "9+" : activeCount}
          </span>
        ) : null}
      </Button>
    );
  },
);
