import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingFilterSidebarProps = {
  /** Accessible name for the filter rail. */
  "aria-label"?: string;
  className?: string;
  children: ReactNode;
};

/**
 * Faceted filter rail for Bid's catalogue pages (a desktop rail, stacked on small screens). It is
 * a named section of the page's main landmark, not an aside, which would sit inside another
 * landmark.
 */
export function MarketingFilterSidebar({
  "aria-label": ariaLabel = "Filters",
  className,
  children,
}: MarketingFilterSidebarProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn("space-y-6 border-border-hairline lg:border-r lg:pr-6", className)}
    >
      {children}
    </section>
  );
}
