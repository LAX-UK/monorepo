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
      {...(innerClassName ? { innerClassName } : {})}
    >
      {children}
    </StickyBidBar>
  );
}
