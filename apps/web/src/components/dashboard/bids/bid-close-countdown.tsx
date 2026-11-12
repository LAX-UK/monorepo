import { LONDON_TIME_ZONE, formatDayMonthOnly, formatTime } from "@auction/datetime";
("use client");

import {
  type CountdownTier,
  countdownTier,
  formatCountdownShort,
  formatCountdownSpoken,
} from "@/lib/format-countdown";
import { useCountdownTick } from "@/lib/time/use-clock";
import { cn } from "@auction/ui/lib/utils";

/**
 * Text colour per urgency. The `*-on-surface` status tokens reach 4.5:1 on the page and card
 * surfaces in light and dark, unlike the bright live red.
 */
const TIER_TONE: Record<CountdownTier, string> = {
  normal: "text-on-surface",
  urgent: "text-warning-on-surface",
  critical: "text-danger-on-surface",
};

/**
 * Time left before a lot closes, in words ("4m 12s"), ticking each second. It warms to amber in
 * the last hour and red in the last ten minutes. The visible text is hidden from screen readers,
 * which get a calm sentence instead of a number that changes every second.
 */
export function BidCloseCountdown({ endsAt, className }: { endsAt: string; className?: string }) {
  const end = Date.parse(endsAt);
  const now = useCountdownTick([end], { surface: "card" });
  if (Number.isNaN(end)) return null;
  // Before the first tick (and on the server) the closing time is shown instead: it does not
  // depend on the clock, so the server and the browser render the same text.
  if (now == null) {
    return (
      <time dateTime={endsAt} className={cn("tabular-nums text-on-surface", className)}>
        {`${formatDayMonthOnly(new Date(end), LONDON_TIME_ZONE)}, ${formatTime(new Date(end), LONDON_TIME_ZONE)}`}
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
