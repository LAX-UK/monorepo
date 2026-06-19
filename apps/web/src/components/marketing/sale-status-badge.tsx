"use client";

import { SaleLifecycleBadge } from "@/components/marketing/sale-lifecycle-badge";
import { SaleCalendarCountdown } from "@/components/sections/sales/sale-calendar-countdown";
import { useOverlayTone } from "@/components/ui/overlay-tone-context";
import { overlayPillClasses, overlayToneProps } from "@/lib/ui/overlay-tone-classes";
import { cn } from "@auction/ui";

type SaleStatusBadgeProps = {
  countdownEndIso: string;
  className?: string;
};

/** Live overlay on sale media — registry live badge + countdown until sale end. */
export function SaleStatusBadge({ countdownEndIso, className }: SaleStatusBadgeProps) {
  const tone = useOverlayTone("bottomLeft");

  return (
    <div
      className={cn(
        overlayPillClasses(tone),
        "absolute bottom-3 left-3 flex min-h-8 items-center gap-1 rounded px-2",
        className,
      )}
      {...overlayToneProps(tone)}
      aria-label="Live auction, time remaining"
    >
      <SaleLifecycleBadge
        status="active"
        className="border-transparent bg-transparent px-0 py-0 ring-0 text-[color:var(--overlay-fg)] [&_span]:bg-[color:var(--overlay-fg)]"
      />
      <SaleCalendarCountdown endIso={countdownEndIso} className="text-[color:var(--overlay-fg)]" />
    </div>
  );
}

type SaleScheduleBadgesProps = {
  isLive: boolean;
  startsSoon: boolean;
};

/** Inline live / scheduled pills for upcoming auction tiles (no media overlay). */
export function SaleScheduleBadges({ isLive, startsSoon }: SaleScheduleBadgesProps) {
  if (!isLive && !startsSoon) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {isLive ? <SaleLifecycleBadge status="active" /> : null}
      {startsSoon && !isLive ? <SaleLifecycleBadge status="scheduled" label="Starts soon" /> : null}
    </div>
  );
}
