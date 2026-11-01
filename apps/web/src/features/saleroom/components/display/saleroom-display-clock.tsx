"use client";

import { formatLondonTime } from "@/lib/datetime/london-time";
import { useEffect, useState } from "react";

type Props = {
  sessionStartedAt: string | null;
  sessionStatus: "none" | "pending" | "live" | "paused" | "ended";
};

function formatClockTime(date: Date): string {
  return formatLondonTime(date);
}

function formatLiveSince(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return formatLondonTime(date);
}

export function SaleroomDisplayClock({ sessionStartedAt, sessionStatus }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const showLiveSince =
    (sessionStatus === "live" || sessionStatus === "paused") && sessionStartedAt != null;
  const liveSinceLabel = sessionStartedAt ? formatLiveSince(sessionStartedAt) : "";

  return (
    <div className="text-right tabular-nums">
      <p className="text-lg font-medium text-white/80 motion-safe:transition-opacity">
        {formatClockTime(now)}
      </p>
      {showLiveSince && liveSinceLabel ? (
        <p className="text-xs uppercase tracking-widest text-white/40">
          Live since {liveSinceLabel}
        </p>
      ) : null}
    </div>
  );
}
