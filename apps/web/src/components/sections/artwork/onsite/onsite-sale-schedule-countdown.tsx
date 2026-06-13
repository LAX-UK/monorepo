"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  type CountdownTier,
  countdownTier,
  formatCountdownAriaLabel,
  formatCountdownForDisplay,
  parseCountdownSegments,
} from "@/lib/format-countdown";
import { useClientClock } from "@/lib/time/use-client-clock";
import type { Sale } from "@auction/types";
import { LiveDot, cn } from "@auction/ui";
import { normalizeAuctionTime, parseNormalizedIsoMs, toDisplayDate } from "@auction/validators";
import { useEffect, useMemo, useState } from "react";

type Props = {
  sale: Sale;
  className?: string;
  variant?: "default" | "compact";
};

type Phase = "before" | "during" | "ended";

/** Coarse bucket for screen-reader announcements (same cadence as packages/ui Countdown). */
function formatAnnounceBucket(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "Ended";
  const d = Math.floor(secondsRemaining / 86_400);
  const h = Math.floor((secondsRemaining % 86_400) / 3600);
  const m = Math.floor((secondsRemaining % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} ${h} hour${h === 1 ? "" : "s"}`;
  if (h > 0) return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
  return `${m} minute${m === 1 ? "" : "s"}`;
}

function formatStartsAriaLabel(ms: number): string {
  if (ms <= 0) return "Live event has started";
  const { days, hours, minutes } = parseCountdownSegments(ms);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
  return `Live event starts in ${parts.join(", ")}`;
}

function formatTargetDatetime(value: Date | string): string {
  const d = toDisplayDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function segmentDigitClass(phase: Phase, tier: CountdownTier): string {
  if (phase === "ended") return "text-on-surface-variant";
  if (phase === "during") return "text-live-red";
  if (tier === "critical" || tier === "urgent") return "text-live-red";
  return "text-on-surface";
}

type SegmentChipProps = {
  value: number;
  unit: string;
  phase: Phase;
  tier: CountdownTier;
  placeholder?: boolean;
};

function SegmentChip({ value, unit, phase, tier, placeholder }: SegmentChipProps) {
  return (
    <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low/50 px-2 py-2 backdrop-blur-sm">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          segmentDigitClass(phase, tier),
          tier === "critical" && phase !== "ended" && !placeholder && "live-dot-pulse",
        )}
      >
        {placeholder ? "\u00A0" : pad2(value)}
      </p>
      <p className="text-[10px] font-body uppercase tracking-wider text-on-surface-variant">
        {unit}
      </p>
    </div>
  );
}

/** Countdown to sale start, then to sale end, then ended (onsite marketing hero). */
export function OnsiteSaleScheduleCountdown({ sale, className, variant = "default" }: Props) {
  const reduced = useReducedMotion();
  const now = useClientClock(1000);

  const startMs = parseNormalizedIsoMs(normalizeAuctionTime(sale.startTime)) ?? Number.NaN;
  const endMs = parseNormalizedIsoMs(normalizeAuctionTime(sale.endTime)) ?? Number.NaN;

  const phase = useMemo((): Phase => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "ended";
    if (now == null) return "before";
    if (now < startMs) return "before";
    if (now < endMs) return "during";
    return "ended";
  }, [now, startMs, endMs]);

  const targetIso =
    phase === "before"
      ? normalizeAuctionTime(sale.startTime)
      : phase === "during"
        ? normalizeAuctionTime(sale.endTime)
        : null;

  const msLeft = useMemo(() => {
    if (now == null) return null;
    if (phase === "before") return Math.max(0, startMs - now);
    if (phase === "during") return Math.max(0, endMs - now);
    return 0;
  }, [phase, startMs, endMs, now]);

  const segments = msLeft != null ? parseCountdownSegments(msLeft) : null;
  const tier = msLeft != null ? countdownTier(msLeft) : "normal";

  const label =
    phase === "before"
      ? "Live event starts in"
      : phase === "during"
        ? "Auction in progress · ends in"
        : "This event has ended";

  const secondaryLine =
    phase === "before"
      ? `Session opens · ${formatTargetDatetime(sale.startTime)}`
      : phase === "during"
        ? `Session ends · ${formatTargetDatetime(sale.endTime)}`
        : null;

  const ariaLabel =
    msLeft == null
      ? label
      : phase === "before"
        ? formatStartsAriaLabel(msLeft)
        : phase === "during"
          ? formatCountdownAriaLabel(msLeft)
          : "This event has ended";

  const secondsRemaining = msLeft != null ? Math.floor(msLeft / 1000) : null;
  const bucket = secondsRemaining != null ? formatAnnounceBucket(secondsRemaining) : "";
  const [liveMessage, setLiveMessage] = useState("");
  useEffect(() => {
    if (secondsRemaining == null || phase === "ended") return;
    const prefix = phase === "before" ? "Live event starts in" : "Time remaining";
    const msg = secondsRemaining <= 0 ? "This event has ended" : `${prefix}: ${bucket}`;
    setLiveMessage((prev) => (prev === msg ? prev : msg));
  }, [bucket, phase, secondsRemaining]);

  const labelRow =
    phase === "during" ? (
      <span className="inline-flex items-center justify-center gap-2">
        <LiveDot className="live-dot-pulse h-2 w-2" aria-hidden />
        {label}
      </span>
    ) : (
      label
    );

  const clock = msLeft != null && phase !== "ended" ? formatCountdownForDisplay(msLeft) : null;

  if (variant === "compact") {
    return (
      <div className={cn("text-left", className)}>
        <p className="font-label text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {phase === "during" ? (
            <span className="inline-flex items-center gap-1.5">
              <LiveDot className="live-dot-pulse h-2 w-2" aria-hidden />
              Live · ends in
            </span>
          ) : phase === "before" ? (
            "Starts in"
          ) : (
            "Ended"
          )}
        </p>
        {phase !== "ended" ? (
          <time
            dateTime={targetIso ?? undefined}
            aria-label={ariaLabel}
            className={cn(
              "mt-0.5 block font-body text-sm font-semibold tabular-nums",
              phase === "during" || tier !== "normal" ? "text-live-red" : "text-on-surface",
            )}
            suppressHydrationWarning
          >
            {clock ?? "\u00A0"}
          </time>
        ) : (
          <p className="mt-0.5 font-body text-sm text-on-surface-variant">This event has ended</p>
        )}
      </div>
    );
  }

  if (reduced && phase !== "ended" && targetIso) {
    return (
      <div className={cn("text-center", className)}>
        <p className="font-body text-sm font-medium text-on-surface-variant sm:text-base">
          {labelRow}
        </p>
        <time
          dateTime={targetIso}
          className="mt-2 block font-body text-lg font-semibold tabular-nums text-on-surface"
          suppressHydrationWarning
        >
          {formatTargetDatetime(targetIso)}
        </time>
      </div>
    );
  }

  const showDays = segments != null && segments.days > 0;
  const placeholder = segments == null && phase !== "ended";

  return (
    <div className={cn("text-center", className)}>
      <p className="font-body text-sm font-medium text-on-surface-variant sm:text-base">
        {labelRow}
      </p>

      {phase !== "ended" ? (
        <>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {liveMessage}
          </span>
          <time
            dateTime={targetIso ?? undefined}
            aria-label={ariaLabel}
            className="mt-3 block"
            suppressHydrationWarning
          >
            <div className={cn("grid gap-2", showDays ? "grid-cols-4" : "grid-cols-3")} aria-hidden>
              {showDays ? (
                <SegmentChip
                  value={segments?.days}
                  unit="Days"
                  phase={phase}
                  tier={tier}
                  placeholder={placeholder}
                />
              ) : null}
              <SegmentChip
                value={segments?.hours ?? 0}
                unit="Hours"
                phase={phase}
                tier={tier}
                placeholder={placeholder}
              />
              <SegmentChip
                value={segments?.minutes ?? 0}
                unit="Min"
                phase={phase}
                tier={tier}
                placeholder={placeholder}
              />
              <SegmentChip
                value={segments?.seconds ?? 0}
                unit="Sec"
                phase={phase}
                tier={tier}
                placeholder={placeholder}
              />
            </div>
          </time>
          {secondaryLine ? (
            <p className="mt-3 font-body text-xs text-on-surface-variant">{secondaryLine}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
