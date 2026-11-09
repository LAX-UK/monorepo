"use client";

import { timerText } from "@/components/lot-timer/format";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatLondonWhen } from "@/lib/datetime/london-time";
import {
  COUNTDOWN_DATE_BEYOND_MS,
  countdownTiles,
  formatCountdownAnnounce,
  formatCountdownAriaLabel,
  formatCountdownForDisplay,
  formatCountdownSpoken,
} from "@/lib/format-countdown";
import {
  type CountdownTone,
  countdownTone,
  countdownToneClass,
} from "@/lib/presenters/countdown-tone";
import { liveUrgencyPulseClass } from "@/lib/presenters/status-presentation";
import { opensLine } from "@/lib/time/opens-line";
import { useCountdownTick } from "@/lib/time/use-clock";
import type { Sale } from "@auction/types";
import { LiveDot, cn } from "@auction/ui";
import {
  isSaleroomDeliveryMode,
  normalizeAuctionTime,
  parseNormalizedIsoMs,
  toDisplayDate,
} from "@auction/validators";
import { useEffect, useMemo, useState } from "react";

type Props = {
  sale: Sale;
  className?: string;
  variant?: "default" | "compact";
};

type Phase = "before" | "during" | "livePastEnd" | "ended";

/** Coarse bucket for screen-reader announcements (same cadence as packages/ui Countdown). */
function formatStartsAriaLabel(ms: number): string {
  if (ms <= 0) return "Live event has started";
  return `Live event starts in ${formatCountdownSpoken(ms)}`;
}

function formatTargetDatetime(value: Date | string): string {
  const d = toDisplayDate(value);
  if (Number.isNaN(d.getTime())) return "";
  return formatLondonWhen(d);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function segmentDigitClass(phase: Phase, tone: CountdownTone): string {
  if (phase === "ended") return "text-on-surface-variant";
  return countdownToneClass(tone);
}

type SegmentChipProps = {
  value: number;
  unit: string;
  phase: Phase;
  tone: CountdownTone;
  placeholder?: boolean;
};

function SegmentChip({ value, unit, phase, tone, placeholder }: SegmentChipProps) {
  return (
    <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low/50 px-2 py-2 backdrop-blur-sm">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          segmentDigitClass(phase, tone),
          tone === "final" && phase !== "ended" && !placeholder && liveUrgencyPulseClass,
        )}
      >
        {placeholder ? "\u00A0" : pad2(value)}
      </p>
      <p className="text-xs font-body text-on-surface-variant">{unit}</p>
    </div>
  );
}

/** Countdown to sale start, then to sale end, then ended (onsite marketing hero). */
export function OnsiteSaleScheduleCountdown({ sale, className, variant = "default" }: Props) {
  const reduced = useReducedMotion();
  const startMs = parseNormalizedIsoMs(normalizeAuctionTime(sale.startTime)) ?? Number.NaN;
  const endMs = parseNormalizedIsoMs(normalizeAuctionTime(sale.endTime)) ?? Number.NaN;
  const now = useCountdownTick([startMs, endMs], { surface: "saleHero" });

  const phase = useMemo((): Phase => {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return "ended";
    if (now == null) return "before";
    if (now < startMs) return "before";
    if (now < endMs) return "during";
    if (sale.status === "active" && isSaleroomDeliveryMode(sale.deliveryMode)) {
      return "livePastEnd";
    }
    return "ended";
  }, [now, startMs, endMs, sale.deliveryMode, sale.status]);

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

  const tone: CountdownTone = msLeft != null ? countdownTone(msLeft) : "calm";

  const label =
    phase === "before"
      ? "Live event starts in"
      : phase === "during"
        ? "Auction in progress · ends in"
        : phase === "livePastEnd"
          ? "Auction in progress"
          : "This event has ended";

  const secondaryLine =
    phase === "before"
      ? `Session opens · ${formatTargetDatetime(sale.startTime)}`
      : phase === "during"
        ? `Session ends · ${formatTargetDatetime(sale.endTime)}`
        : phase === "livePastEnd"
          ? `Scheduled end · ${formatTargetDatetime(sale.endTime)}`
          : null;

  const ariaLabel =
    msLeft == null
      ? label
      : phase === "before"
        ? formatStartsAriaLabel(msLeft)
        : phase === "during"
          ? formatCountdownAriaLabel(msLeft)
          : phase === "livePastEnd"
            ? "Auction in progress"
            : "This event has ended";

  const secondsRemaining = msLeft != null ? Math.floor(msLeft / 1000) : null;
  const bucket = secondsRemaining != null ? formatCountdownAnnounce(secondsRemaining * 1000) : "";
  const [liveMessage, setLiveMessage] = useState("");
  useEffect(() => {
    if (secondsRemaining == null || phase === "ended" || phase === "livePastEnd") return;
    const prefix = phase === "before" ? "Live event starts in" : "Time remaining";
    const msg = secondsRemaining <= 0 ? "This event has ended" : `${prefix}: ${bucket}`;
    setLiveMessage((prev) => (prev === msg ? prev : msg));
  }, [bucket, phase, secondsRemaining]);

  const labelRow =
    phase === "during" || phase === "livePastEnd" ? (
      <span className="inline-flex items-center justify-center gap-2">
        <LiveDot className="live-dot-pulse h-2 w-2" aria-hidden />
        {label}
      </span>
    ) : (
      label
    );

  // Before the start the time rule decides: a date beyond a week, then the time left.
  const startsLine =
    phase === "before" && now != null && Number.isFinite(startMs)
      ? opensLine(new Date(startMs), new Date(now), "Starts")
      : null;
  const clock =
    phase === "during" && msLeft != null && now != null
      ? (timerText(msLeft, now).date ?? formatCountdownForDisplay(msLeft))
      : (startsLine?.value ?? null);

  if (variant === "compact") {
    return (
      <div className={cn("text-left", className)}>
        <p className="font-label text-xs font-medium text-on-surface-variant">
          {phase === "during" ? (
            <span className="inline-flex items-center gap-1.5">
              <LiveDot className="live-dot-pulse h-2 w-2" aria-hidden />
              Live · ends in
            </span>
          ) : phase === "livePastEnd" ? (
            <span className="inline-flex items-center gap-1.5">
              <LiveDot className="live-dot-pulse h-2 w-2" aria-hidden />
              Live
            </span>
          ) : phase === "before" ? (
            (startsLine?.label ?? "Starts in")
          ) : (
            "Ended"
          )}
        </p>
        {phase === "before" || phase === "during" ? (
          <time
            dateTime={targetIso ?? undefined}
            className={cn(
              "mt-0.5 block font-body text-sm font-semibold tabular-nums",
              phase === "during" || tone !== "calm" ? countdownToneClass(tone) : "text-on-surface",
            )}
            suppressHydrationWarning
          >
            <span className="sr-only">{ariaLabel}</span>
            <span aria-hidden>{clock ?? "\u00A0"}</span>
          </time>
        ) : phase === "livePastEnd" ? null : (
          <p className="mt-0.5 font-body text-sm text-on-surface-variant">This event has ended</p>
        )}
      </div>
    );
  }

  // Beyond a week the date is the answer; the tiles start from a week down.
  const beyondAWeek = msLeft != null && msLeft > COUNTDOWN_DATE_BEYOND_MS;
  if ((reduced || beyondAWeek) && (phase === "before" || phase === "during") && targetIso) {
    return (
      <div className={cn("text-center", className)}>
        <p className="font-body text-sm font-medium text-on-surface-variant sm:text-base">
          {beyondAWeek
            ? phase === "before"
              ? "Live event starts"
              : "Auction in progress · ends"
            : labelRow}
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

  const tiles = countdownTiles(msLeft ?? 0);
  const placeholder = msLeft == null && (phase === "before" || phase === "during");

  return (
    <div className={cn("text-center", className)}>
      <p className="font-body text-sm font-medium text-on-surface-variant sm:text-base">
        {labelRow}
      </p>

      {phase === "before" || phase === "during" ? (
        <>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {liveMessage}
          </span>
          <time dateTime={targetIso ?? undefined} className="mt-3 block" suppressHydrationWarning>
            <span className="sr-only">{ariaLabel}</span>
            <div className="grid grid-cols-2 gap-2" aria-hidden>
              {tiles.map((tile) => (
                <SegmentChip
                  key={tile.unit}
                  value={tile.value}
                  unit={tile.unit}
                  phase={phase}
                  tone={tone}
                  placeholder={placeholder}
                />
              ))}
            </div>
          </time>
          {secondaryLine ? (
            <p className="mt-3 font-body text-xs text-on-surface-variant">{secondaryLine}</p>
          ) : null}
        </>
      ) : phase === "livePastEnd" && secondaryLine ? (
        <p className="mt-3 font-body text-xs text-on-surface-variant">{secondaryLine}</p>
      ) : null}
    </div>
  );
}
