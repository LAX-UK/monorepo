"use client";

import * as React from "react";
import { useClockNow } from "../../clock/index.js";
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

export type CountdownUrgency = "normal" | "soon" | "imminent";

export type CountdownProps = {
  end: Date;
  /** The one time wording, from milliseconds left: the app passes its countdown formatter. */
  format: (msRemaining: number, end: Date) => string;
  className?: string;
  /** When false, no live region (visual only). */
  announce?: boolean;
  /** Threshold in seconds for `soon` urgency (color shift). Default 300 (5 min). */
  soonThresholdSec?: number;
  /** Threshold in seconds for `imminent` urgency (pulse). Default 10. */
  imminentThresholdSec?: number;
  /** Optional callback when urgency level changes (e.g., to trigger ambient effects). */
  onUrgencyChange?: (urgency: CountdownUrgency) => void;
  /** Style emphasis. `display` uses larger tabular figures with letter spacing. */
  variant?: "default" | "display";
};

/** Countdown with polite `aria-live` updates when the announce bucket changes.
 *
 * Urgency thresholds drive a `data-urgency` attribute consumers can style:
 *   - `normal`  : > soonThresholdSec
 *   - `soon`    : <= soonThresholdSec, > imminentThresholdSec
 *   - `imminent`: <= imminentThresholdSec
 */
export function Countdown({
  end,
  format,
  className,
  announce = true,
  soonThresholdSec = 300,
  imminentThresholdSec = 10,
  onUrgencyChange,
  variant = "default",
}: CountdownProps) {
  /** `null` on the server and until mount, so the server render and first paint match. */
  const now = useClockNow(1000);
  const endMs = end.getTime();

  const secondsRemaining = now == null ? null : clampMs(Math.floor((endMs - now) / 1000));
  const display =
    secondsRemaining == null
      ? "…"
      : secondsRemaining <= 0
        ? "Ended"
        : format(secondsRemaining * 1000, end);
  const bucket = secondsRemaining == null ? "" : formatAnnounceBucket(secondsRemaining);

  const urgency: CountdownUrgency =
    secondsRemaining == null
      ? "normal"
      : secondsRemaining <= imminentThresholdSec
        ? "imminent"
        : secondsRemaining <= soonThresholdSec
          ? "soon"
          : "normal";

  const lastUrgencyRef = React.useRef<CountdownUrgency>(urgency);
  React.useEffect(() => {
    if (lastUrgencyRef.current !== urgency) {
      lastUrgencyRef.current = urgency;
      onUrgencyChange?.(urgency);
    }
  }, [urgency, onUrgencyChange]);

  const [liveMessage, setLiveMessage] = React.useState("");
  React.useEffect(() => {
    if (!announce) return;
    if (secondsRemaining == null) return;
    const msg = secondsRemaining <= 0 ? "Auction ended" : `Time remaining: ${bucket}`;
    setLiveMessage((prev) => (prev === msg ? prev : msg));
  }, [announce, bucket, secondsRemaining]);

  const variantClass =
    variant === "display"
      ? "tabular-nums tracking-[0.04em] text-[clamp(2rem,3vw+0.5rem,3.25rem)] leading-none"
      : "tabular-nums";

  const urgencyClass =
    urgency === "imminent"
      ? "text-live-red live-dot-pulse"
      : urgency === "soon"
        ? "text-live-red"
        : undefined;

  return (
    <span
      className={cn("inline-flex flex-col transition-colors", className)}
      data-urgency={urgency}
      style={{ transitionDuration: "var(--motion-duration-lg, 520ms)" }}
    >
      {announce ? (
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {liveMessage}
        </span>
      ) : null}
      <span className={cn(variantClass, urgencyClass)} aria-hidden={announce}>
        {display}
      </span>
    </span>
  );
}
