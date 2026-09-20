import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingChipStripProps = {
  children: ReactNode;
  /** Accessible name when the strip is a navigational region. */
  "aria-label"?: string;
  className?: string;
  /** Allow chips to wrap on large screens (active filters). */
  wrapOnDesktop?: boolean;
};

/** Single-row horizontal scroll for filter/category chips (marketing catalogue). */
export function MarketingChipStrip({
  children,
  "aria-label": ariaLabel,
  className,
  wrapOnDesktop = false,
}: MarketingChipStripProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "w-full overflow-x-auto scroll-pl-0 scroll-pr-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        wrapOnDesktop && "md:flex-wrap md:overflow-visible md:snap-none",
        className,
      )}
    >
      <div
        className={cn(
          "inline-flex min-w-full items-center gap-2",
          wrapOnDesktop && "md:inline-flex md:min-w-0 md:flex-wrap",
        )}
      >
        {children}
      </div>
    </div>
  );
}
