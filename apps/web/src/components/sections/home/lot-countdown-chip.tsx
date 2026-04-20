"use client";

import { formatCountdownClock } from "@/lib/format-countdown";
import { useEffect, useState } from "react";

type Props = {
  endTime: Date;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

export function LotCountdownChip({ endTime }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loop = () => {
      if (cancelled) return;
      setNow(Date.now());
      const ms = endTime.getTime() - Date.now();
      if (ms <= 0) return;
      const nextDelay = ms > ONE_HOUR_MS ? 30_000 : 1_000;
      timeoutId = setTimeout(loop, nextDelay);
    };

    loop();
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [endTime]);

  const ms = endTime.getTime() - now;
  if (ms <= 0) {
    return (
      <span
        className="rounded-sm bg-inverse-surface/80 px-2 py-1 font-label text-xs font-bold uppercase tracking-widest text-inverse-on-surface backdrop-blur-sm"
        aria-live="polite"
        aria-atomic="true"
      >
        Closed
      </span>
    );
  }

  return (
    <span
      className="rounded-sm bg-inverse-surface/80 px-2 py-1 font-mono text-xs tabular-nums text-inverse-on-surface backdrop-blur-sm"
      aria-live="polite"
      aria-atomic="true"
    >
      {formatCountdownClock(ms)}
    </span>
  );
}
