import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingFilterSidebarProps = {
  /** Accessible name for the filter rail. */
  "aria-label"?: string;
  className?: string;
  children: ReactNode;
};

/** Faceted filter rail for marketing catalogue pages (desktop rail + stacked on small screens). */
export function MarketingFilterSidebar({
  "aria-label": ariaLabel = "Filters",
  className,
  children,
}: MarketingFilterSidebarProps) {
  return (
    <aside
      aria-label={ariaLabel}
      className={cn("space-y-6 border-border-hairline md:border-r md:pr-6", className)}
    >
      {children}
    </aside>
  );
}
