"use client";

import { formatCountdownForDisplay } from "@/lib/format-countdown";
import type { Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { useEffect, useMemo, useState } from "react";

type Props = {
  sale: Sale;
  className?: string;
};

/** Countdown to sale start, then to sale end, then ended (onsite marketing hero). */
export function OnsiteSaleScheduleCountdown({ sale, className }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const startMs = new Date(sale.startTime).getTime();
  const endMs = new Date(sale.endTime).getTime();

  const phase = useMemo(() => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "ended" as const;
    if (now < startMs) return "before" as const;
    if (now < endMs) return "during" as const;
    return "ended" as const;
  }, [now, startMs, endMs]);

  const msLeft = useMemo(() => {
    if (phase === "before") return Math.max(0, startMs - now);
    if (phase === "during") return Math.max(0, endMs - now);
    return 0;
  }, [phase, startMs, endMs, now]);

  const clock = formatCountdownForDisplay(msLeft);

  const label =
    phase === "before"
      ? "Live event starts in"
      : phase === "during"
        ? "Auction in progress · ends in"
        : "This event has ended";

  return (
    <div className={cn("text-center", className)}>
      <p className="font-body text-sm font-medium text-[#D1D1D1] sm:text-base">{label}</p>
      {phase !== "ended" ? (
        <p
          className={cn(
            "mt-2 font-bold tabular-nums text-[#F1F1F3] sm:text-2xl",
            msLeft < 60_000 ? "text-live-red" : "",
          )}
        >
          {clock}
        </p>
      ) : null}
    </div>
  );
}
