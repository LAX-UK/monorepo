import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingStickyActionBarProps = {
  children: ReactNode;
  /** Accessible name of the action group, e.g. "Artwork actions". */
  ariaLabel: string;
  /**
   * Distance from the viewport bottom as a CSS length, e.g. a fixed bottom nav's height
   * (`var(--art-bottom-nav-height)`). That height is expected to include the safe-area inset;
   * without an offset the bar pads for the inset itself.
   */
  bottomOffset?: string;
  /**
   * From `md` the bar renders in normal flow instead of fixed. Callers then mount stateful
   * controls (an enquiry sheet trigger) once and get both layouts, instead of two instances
   * whose dialogs would open together.
   */
  inlineFromMd?: boolean;
  className?: string;
};

/**
 * Mobile action bar fixed to the bottom of the viewport (generalises `StickyBidBar` from
 * `@auction/ui`). It overlays the page, so the page must reserve bottom padding for it.
 */
export function MarketingStickyActionBar({
  children,
  ariaLabel,
  bottomOffset,
  inlineFromMd = false,
  className,
}: MarketingStickyActionBarProps) {
  return (
    <section
      aria-label={ariaLabel}
      data-testid="marketing-sticky-action-bar"
      style={bottomOffset ? { bottom: bottomOffset } : undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-outline-variant/40 bg-surface/95 px-4 pt-3 shadow-[0_-8px_24px_rgb(0_0_0/0.08)] backdrop-blur-md",
        bottomOffset ? "pb-3" : "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        inlineFromMd &&
          "md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none",
        className,
      )}
    >
      {children}
    </section>
  );
}
