import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
import { StickyBidBar, cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingStickyBidBarProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/** Mobile sticky bottom bar (`lg:hidden`); wraps `@auction/ui` `StickyBidBar`. */
export function MarketingStickyBidBar({
  children,
  className,
  innerClassName,
}: MarketingStickyBidBarProps) {
  return (
    <StickyBidBar
      className={cn("lg:hidden", className)}
      innerClassName={cn(
        MARKETING_PAGE_INNER,
        "flex w-full items-center justify-between gap-3",
        innerClassName,
      )}
    >
      {children}
    </StickyBidBar>
  );
}
