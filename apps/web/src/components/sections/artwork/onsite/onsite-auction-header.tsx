"use client";

import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { cn } from "@auction/ui";
import { useEffect, useMemo, useState } from "react";

type Props = {
  saleTitle: string;
  lotLabel: string;
  /** Milliseconds epoch when the sale (or lot) ends */
  endAtMs: number;
  className?: string;
};

export function OnsiteAuctionHeader({ saleTitle, lotLabel, endAtMs, className }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const msLeft = Math.max(0, endAtMs - now);
  const clock = useMemo(() => formatCountdownForDisplay(msLeft), [msLeft]);

  const urgency = msLeft < 60_000 ? "critical" : msLeft < 300_000 ? "soon" : ("ok" as const);

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
          >
            {clock}
          </span>
        </p>
      </div>
    </header>
  );
}
