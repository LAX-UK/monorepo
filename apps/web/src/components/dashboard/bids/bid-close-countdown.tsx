"use client";

import { useNow } from "@/hooks/use-now";
import {
  type CountdownTier,
  countdownTier,
  formatCountdownShort,
  formatCountdownSpoken,
} from "@/lib/format-countdown";
import { cn } from "@auction/ui";

/**
 * Text colour per urgency. The `*-on-surface` status tokens reach 4.5:1 on the page and card
 * surfaces in light and dark, unlike the bright live red.
 */
const TIER_TONE: Record<CountdownTier, string> = {
  normal: "text-on-surface",
  urgent: "text-warning-on-surface",
  critical: "text-danger-on-surface",
};

/** "1 Nov, 12:00", in UK time, the same on the server and in every browser. */
const CLOSING_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

/**
 * Time left before a lot closes, in words ("4m 12s"), ticking each second. It warms to amber in
 * the last hour and red in the last ten minutes. The visible text is hidden from screen readers,
 * which get a calm sentence instead of a number that changes every second.
 */
export function BidCloseCountdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const now = useNow(1000);
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return null;
  // Before the first tick (and on the server) the closing time is shown instead: it does not
  // depend on the clock, so the server and the browser render the same text.
  if (now == null) {
    return (
      <time dateTime={endsAt} className={cn("tabular-nums text-on-surface", className)}>
        {CLOSING_TIME.format(end)}
      </time>
    );
  }
  const left = end - now;
  if (left <= 0) {
    return <span className={cn("text-on-surface-variant", className)}>Closing</span>;
  }
  return (
    <span className={cn("tabular-nums", TIER_TONE[countdownTier(left)], className)}>
      <span aria-hidden>{formatCountdownShort(left)}</span>
      <span className="sr-only">{formatCountdownSpoken(left)}</span>
    </span>
  );
}
