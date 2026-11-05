"use client";

import type { SiteHeaderTone } from "@/lib/layout/header-chrome-tone";
import { FOCUS_RING } from "@/lib/marketing/chrome";
import { LaxLockup } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

/**
 * LAX Bid's header lockup. Below 1024px, where the bar is the slim 56px one, it is the LAX mark
 * (28px) with the ".BID" tag, not the gavel on its own; from 1024px it is the full Bid lockup, 40px tall. The lockup takes its colour
 * from the text, so over a hero photograph it is white and on the page it follows the theme.
 */
export function BidHeaderLockup({
  tone = "on-light",
  onNavigate,
}: { tone?: SiteHeaderTone; onNavigate?: () => void }) {
  const onDark = tone === "on-dark";
  const colour = onDark
    ? "text-hero-foreground [--color-product-accent:currentColor]"
    : "text-on-surface";
  return (
    <Link
      href="/"
      aria-label="LAX Bid home"
      data-testid="bid-header-lockup"
      className={cn("site-header-logo flex shrink-0 items-center rounded-sm", colour, FOCUS_RING)}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      {/* h-7 is LOCKUP_HEIGHTS.phoneMark (28px) and h-10 is LOCKUP_HEIGHTS.desktopBid (40px). */}
      <LaxLockup kind="bid-compact" className="block h-7 w-auto lg:hidden" />
      <LaxLockup kind="bid" className="hidden h-10 w-auto lg:block" />
    </Link>
  );
}
