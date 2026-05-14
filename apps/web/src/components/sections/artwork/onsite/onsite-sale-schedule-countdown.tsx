"use client";

import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { useClientClock } from "@/lib/time/use-client-clock";
import type { Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { useMemo } from "react";

type Props = {
  sale: Sale;
  className?: string;
};

/** Countdown to sale start, then to sale end, then ended (onsite marketing hero). */
export function OnsiteSaleScheduleCountdown({ sale, className }: Props) {
  // `null` during SSR + first client render so hydration matches; ticks after mount.
  const now = useClientClock(1000);

  const startMs = new Date(sale.startTime).getTime();
  const endMs = new Date(sale.endTime).getTime();

  const phase = useMemo(() => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "ended" as const;
    if (now == null) return "before" as const;
    if (now < startMs) return "before" as const;
    if (now < endMs) return "during" as const;
    return "ended" as const;
  }, [now, startMs, endMs]);

  const msLeft = useMemo(() => {
    if (now == null) return null;
    if (phase === "before") return Math.max(0, startMs - now);
    if (phase === "during") return Math.max(0, endMs - now);
    return 0;
  }, [phase, startMs, endMs, now]);

  const clock = msLeft == null ? null : formatCountdownForDisplay(msLeft);

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
            msLeft != null && msLeft < 60_000 ? "text-live-red" : "",
          )}
          suppressHydrationWarning
        >
          {clock ?? "\u00A0"}
        </p>
      ) : null}
    </div>
  );
}
