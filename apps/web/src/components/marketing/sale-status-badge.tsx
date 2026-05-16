"use client";

import { SaleCalendarCountdown } from "@/components/sections/sales/sale-calendar-countdown";
import { LiveDot, cn } from "@auction/ui";

type SaleStatusBadgeProps = {
  countdownEndIso: string;
  className?: string;
};

/** Live overlay on sale media — countdown until sale end. */
export function SaleStatusBadge({ countdownEndIso, className }: SaleStatusBadgeProps) {
  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 flex min-h-8 items-center gap-1 rounded bg-scrim-hero-soft px-2",
        className,
      )}
      aria-label="Live auction, time remaining"
    >
      <LiveDot size="sm" className="shrink-0" />
      <span className="font-body text-sm font-semibold leading-4 text-cta-on">Live</span>
      <SaleCalendarCountdown endIso={countdownEndIso} className="text-cta-on" />
    </div>
  );
}

const schedulePillClass =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-[0.08em]";

type SaleScheduleBadgesProps = {
  isLive: boolean;
  startsSoon: boolean;
};

/** Inline live / starts-soon pills for upcoming auction tiles (no media overlay). */
export function SaleScheduleBadges({ isLive, startsSoon }: SaleScheduleBadgesProps) {
  if (!isLive && !startsSoon) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isLive ? (
        <span
          className={cn(
            schedulePillClass,
            "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100",
          )}
        >
          <span
            className="size-1.5 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse"
            aria-hidden
          />
          Live
        </span>
      ) : null}
      {startsSoon && !isLive ? (
        <span
          className={cn(
            schedulePillClass,
            "border-neutral-300 bg-neutral-100 text-neutral-800 dark:border-outline dark:bg-surface-container-high dark:text-on-surface-variant",
          )}
        >
          Starts soon
        </span>
      ) : null}
    </div>
  );
}
