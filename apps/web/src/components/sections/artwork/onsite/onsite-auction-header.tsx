"use client";

import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { useClientClock } from "@/lib/time/use-client-clock";
import { cn } from "@auction/ui";
import { useMemo } from "react";

type Props = {
  saleTitle: string;
  lotLabel: string;
  /** Milliseconds epoch when the sale (or lot) ends */
  endAtMs: number;
  className?: string;
};

export function OnsiteAuctionHeader({ saleTitle, lotLabel, endAtMs, className }: Props) {
  // `null` during SSR + first client render so hydration matches; ticks after mount.
  const now = useClientClock(1000);

  const msLeft = now == null ? null : Math.max(0, endAtMs - now);
  const clock = useMemo(
    () => (msLeft == null ? null : formatCountdownForDisplay(msLeft)),
    [msLeft],
  );

  const urgency: "critical" | "soon" | "ok" =
    msLeft == null ? "ok" : msLeft < 60_000 ? "critical" : msLeft < 300_000 ? "soon" : "ok";

  return (
    <header
      className={cn("border-b border-[#D1D1D1] pb-4 dark:border-outline-variant/30", className)}
    >
      <div className="flex flex-col items-center gap-1 text-center sm:gap-2">
        <p className="font-body text-xl font-medium text-[#050505] dark:text-on-surface sm:text-2xl lg:text-[28px] lg:leading-9">
          {saleTitle}
          <span className="text-[#474747] dark:text-on-surface-variant"> / {lotLabel}</span>
        </p>
        <p className="flex flex-wrap items-center justify-center gap-1 font-body">
          <span className="text-xs font-medium text-[#474747] dark:text-on-surface-variant sm:text-sm">
            Ends in
          </span>
          <span
            className={cn(
              "font-bold tabular-nums transition-colors duration-500 motion-reduce:transition-none sm:text-lg lg:text-xl",
              urgency === "critical" && "text-[#EA1717] dark:text-live-red",
              urgency === "soon" && "text-amber-600 dark:text-amber-400",
              urgency === "ok" && "text-[#474747] dark:text-on-surface-variant",
            )}
            suppressHydrationWarning
          >
            {clock ?? "\u00A0"}
          </span>
        </p>
      </div>
    </header>
  );
}
