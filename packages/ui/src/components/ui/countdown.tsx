"use client";

import * as React from "react";
import { cn } from "../../lib/utils.js";

function clampMs(ms: number) {
  return Math.max(0, ms);
}

/** Coarse bucket for screen-reader announcements (changes at most once per minute for sub-day ranges). */
function formatAnnounceBucket(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "Ended";
  const d = Math.floor(secondsRemaining / 86400);
  const h = Math.floor((secondsRemaining % 86400) / 3600);
  const m = Math.floor((secondsRemaining % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} ${h} hour${h === 1 ? "" : "s"}`;
  if (h > 0) return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
  return `${m} minute${m === 1 ? "" : "s"}`;
}

function formatDisplay(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "Ended";
  const d = Math.floor(secondsRemaining / 86400);
  const h = Math.floor((secondsRemaining % 86400) / 3600);
  const m = Math.floor((secondsRemaining % 3600) / 60);
  const s = secondsRemaining % 60;
  if (d > 0)
    return `${d}d ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type CountdownProps = {
  end: Date;
  className?: string;
  /** When false, no live region (visual only). */
  announce?: boolean;
};

/** Countdown with polite `aria-live` updates when the announce bucket changes (minute-level for &lt; 24h).
 */
export function Countdown({ end, className, announce = true }: CountdownProps) {
  const [now, setNow] = React.useState(() => Date.now());
  const endMs = end.getTime();

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const secondsRemaining = clampMs(Math.floor((endMs - now) / 1000));
  const display = formatDisplay(secondsRemaining);
  const bucket = formatAnnounceBucket(secondsRemaining);

  const [liveMessage, setLiveMessage] = React.useState("");
  React.useEffect(() => {
    if (!announce) return;
    const msg = secondsRemaining <= 0 ? "Auction ended" : `Time remaining: ${bucket}`;
    setLiveMessage((prev) => {
      if (prev === msg) return prev;
      return msg;
    });
  }, [announce, bucket, secondsRemaining]);

  return (
    <span className={cn("inline-flex flex-col", className)}>
      {announce ? (
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </span>
      ) : null}
      <span className="tabular-nums" aria-hidden={announce}>
        {display}
      </span>
    </span>
  );
}
