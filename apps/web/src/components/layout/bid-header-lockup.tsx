import { FOCUS_RING } from "@/lib/marketing/chrome";
import { LaxLockup } from "@auction/marketing-ui/lax-lockup";
import { cn } from "@auction/ui/lib/utils";
import Link from "next/link";

/**
 * LAX Bid's header lockup. Below 1024px, where the bar is the slim 56px one, it is the LAX mark
 * (28px) with the ".BID" tag, not the gavel on its own; from 1024px it is the full Bid lockup, 40px tall. The lockup takes its colour
 * from the text: on the page it follows the theme, and in a header that sits over a hero
 * photograph (`data-header-tone="on-dark"` on the header, which carries `group/header`) it is
 * white. It needs no tone prop, so the server draws it and the phone menu shows the same one.
 */
export function BidHeaderLockup({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      aria-label="LAX Bid home"
      data-testid="bid-header-lockup"
      className={cn(
        "site-header-logo flex shrink-0 items-center rounded-sm text-on-surface group-data-[header-tone=on-dark]/header:text-hero-foreground group-data-[header-tone=on-dark]/header:[--color-product-accent:currentColor]",
        FOCUS_RING,
      )}
      {...(onNavigate ? { onClick: onNavigate } : {})}
    >
      {/* h-7 is LOCKUP_HEIGHTS.phoneMark (28px) and h-10 is LOCKUP_HEIGHTS.desktopBid (40px). */}
      <LaxLockup kind="bid-compact" className="block h-7 w-auto lg:hidden" />
      <LaxLockup kind="bid" className="hidden h-10 w-auto lg:block" />
    </Link>
  );
}
