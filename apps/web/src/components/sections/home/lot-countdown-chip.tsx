"use client";

import { formatCountdownClock } from "@/lib/format-countdown";
import { useEffect, useState } from "react";

type Props = {
  endTime: Date;
};

export function LotCountdownChip({ endTime }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ms = endTime.getTime() - now;
  if (ms <= 0) {
    return (
      <span className="rounded-sm bg-inverse-surface/80 px-2 py-1 font-label text-xs font-bold uppercase tracking-widest text-inverse-on-surface backdrop-blur-sm">
        Closed
      </span>
    );
  }

  return (
    <span className="rounded-sm bg-inverse-surface/80 px-2 py-1 font-mono text-xs tabular-nums text-inverse-on-surface backdrop-blur-sm">
      {formatCountdownClock(ms)}
    </span>
  );
}
