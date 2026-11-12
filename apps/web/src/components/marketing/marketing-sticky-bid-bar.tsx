"use client";

import { CookieDockSlot } from "@/components/marketing/consent/cookie-dock";
import { useClaimBottomSlot } from "@auction/marketing-ui/bottom-bar/bottom-slot";
import { laxDensityAttributes } from "@auction/ui/lax/density-attributes";
import { cn } from "@auction/ui/lib/utils";
import type { ReactNode } from "react";

export type MarketingStickyBidBarProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * The sale page's bar on phones, in the kit's bottom-bar look (the same surface as the lot page's
 * bar). It sits in the cookie dock, stacked under the cookie banner, so the two never cover each
 * other, and the dock reserves the space at the end of the page. It holds the shared bottom slot
 * while it is mounted, so the docked tab bar steps aside and comes back when it goes. It is a
 * labelled region, not a dialog, so focus is never trapped. From 768px it is not drawn: the
 * page's own actions are in reach there.
 */
export function MarketingStickyBidBar({
  children,
  className,
  innerClassName,
}: MarketingStickyBidBarProps) {
  // Holds the shared bottom slot, so the docked tab bar never stacks under this bar.
  useClaimBottomSlot("sale-sticky-bid-bar");
  return (
    <CookieDockSlot>
      <section
        aria-label="Sale"
        {...laxDensityAttributes("client")}
        className={cn(
          "border-t border-lax-line bg-lax-raised px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] font-lax text-lax-fg shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.18)] md:hidden",
          className,
        )}
      >
        <div className={cn("flex w-full items-center justify-between gap-3", innerClassName)}>
          {children}
        </div>
      </section>
    </CookieDockSlot>
  );
}
