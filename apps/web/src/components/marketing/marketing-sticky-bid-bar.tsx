"use client";

import { CookieDockSlot } from "@/components/marketing/consent/cookie-dock";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";
import type { ReactNode } from "react";

export type MarketingStickyBidBarProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * The sale page's bar on phones. It sits in the cookie dock, stacked under the cookie banner, so the
 * two never cover each other, and the dock reserves the space at the end of the page.
 */
export function MarketingStickyBidBar({
  children,
  className,
  innerClassName,
}: MarketingStickyBidBarProps) {
  return (
    <CookieDockSlot>
      <section
        aria-label="Sale"
        className={cn(
          "border-t border-outline-variant/25 bg-surface-container-lowest pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] dark:border-outline-variant/20 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)] lg:hidden",
          className,
        )}
      >
        <div
          className={cn(
            MARKETING_PAGE_INNER,
            "flex w-full items-center justify-between gap-3",
            innerClassName,
          )}
        >
          {children}
        </div>
      </section>
    </CookieDockSlot>
  );
}
