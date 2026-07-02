"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import {
  type CountdownTier,
  countdownTier,
  formatCountdownAriaLabel,
  parseCountdownSegments,
} from "@/lib/format-countdown";
import {
  type LiveCountdownUrgency,
  liveUrgencyPulseClass,
  liveUrgencyTextClass,
} from "@/lib/presenters/status-presentation";
import { useActiveSaleCountdownEndIso } from "@/lib/sale/use-active-sale-countdown-end-iso";
import { useClientClock } from "@/lib/time/use-client-clock";
import type { SaleDeliveryMode } from "@auction/types";
import { LabelCaps, LiveDot, cn } from "@auction/ui";
import { isSaleroomDeliveryMode, toDisplayDate } from "@auction/validators";
import { useEffect, useMemo, useState } from "react";

type Props = {
  /** e.g. "Closes in" or "Opens in". */
  label: string;
  endIso: string;
  showLiveDot?: boolean;
  /** Muted line below chips (e.g. "Ends · 14 Jun 2026, 18:00"). */
  secondaryLine?: string | null;
  className?: string;
  status?: string;
  deliveryMode?: SaleDeliveryMode;
  endTime?: Date | string;
};

function formatAnnounceBucket(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "Ended";
  const d = Math.floor(secondsRemaining / 86_400);
  const h = Math.floor((secondsRemaining % 86_400) / 3600);
  const m = Math.floor((secondsRemaining % 3600) / 60);
  if (d > 0) return `${d} day${d === 1 ? "" : "s"} ${h} hour${h === 1 ? "" : "s"}`;
  if (h > 0) return `${h} hour${h === 1 ? "" : "s"} ${m} minute${m === 1 ? "" : "s"}`;
  return `${m} minute${m === 1 ? "" : "s"}`;
}

function formatOpensAriaLabel(ms: number): string {
  if (ms <= 0) return "Sale has opened";
  const { days, hours, minutes } = parseCountdownSegments(ms);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours > 0) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  }
  return `Opens in ${parts.join(", ")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function tierToUrgency(isLive: boolean, tier: CountdownTier): LiveCountdownUrgency {
  if (isLive) return "live";
  if (tier === "critical") return "imminent";
  if (tier === "urgent") return "soon";
  return "normal";
}

function segmentDigitClass(isLive: boolean, tier: CountdownTier, ended: boolean): string {
  if (ended) return "text-on-surface-variant";
  return liveUrgencyTextClass(tierToUrgency(isLive, tier));
}

type SegmentChipProps = {
  value: number;
  unit: string;
  isLive: boolean;
  tier: CountdownTier;
  ended: boolean;
  placeholder?: boolean;
};

function SegmentChip({ value, unit, isLive, tier, ended, placeholder }: SegmentChipProps) {
  return (
    <div className="rounded-lg border border-outline-variant/15 bg-surface-container-low/50 px-2 py-2 backdrop-blur-sm">
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          segmentDigitClass(isLive, tier, ended),
          tier === "critical" && !ended && !placeholder && liveUrgencyPulseClass,
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

/** Segmented marketing countdown (Days / Hours / Min / Sec) with urgency styling. */
export function MarketingCountdownPanel({
  label,
  endIso,
  showLiveDot = false,
  secondaryLine,
  className,
  status,
  deliveryMode,
  endTime,
}: Props) {
  const reduced = useReducedMotion();
  const nowMs = useClientClock(1000);

  const isActiveSaleroomCountdown =
    status === "active" && deliveryMode != null && isSaleroomDeliveryMode(deliveryMode);

  const reactiveEndIso = useActiveSaleCountdownEndIso({
    status: status ?? "active",
    endTime: endTime ?? endIso,
    ...(deliveryMode != null ? { deliveryMode } : {}),
    initialEndIso: endIso,
  });

  const effectiveEndIso = isActiveSaleroomCountdown ? reactiveEndIso : endIso;

  const endMs = useMemo(() => {
    if (effectiveEndIso == null) return Number.NaN;
    const d = toDisplayDate(effectiveEndIso);
    return Number.isNaN(d.getTime()) ? Number.NaN : d.getTime();
  }, [effectiveEndIso]);

  const msLeft = useMemo(() => {
    if (nowMs == null || !Number.isFinite(endMs)) return null;
    return Math.max(0, endMs - nowMs);
  }, [nowMs, endMs]);

  const ended = msLeft === 0 && nowMs != null;
  const segments = msLeft != null ? parseCountdownSegments(msLeft) : null;
  const tier = msLeft != null ? countdownTier(msLeft) : "normal";

  const ariaLabel =
    msLeft == null
      ? label
      : showLiveDot
        ? formatCountdownAriaLabel(msLeft)
        : formatOpensAriaLabel(msLeft);

  const secondsRemaining = msLeft != null ? Math.floor(msLeft / 1000) : null;
  const bucket = secondsRemaining != null ? formatAnnounceBucket(secondsRemaining) : "";
  const [liveMessage, setLiveMessage] = useState("");
  useEffect(() => {
    if (secondsRemaining == null || ended) return;
    const msg = secondsRemaining <= 0 ? "Sale ended" : `${label}: ${bucket}`;
    setLiveMessage((prev) => (prev === msg ? prev : msg));
  }, [bucket, ended, label, secondsRemaining]);

  const showDays = segments != null && segments.days > 0;
  const placeholder = segments == null && !ended;

  if (isActiveSaleroomCountdown && effectiveEndIso == null) {
    return null;
  }

  if (reduced && Number.isFinite(endMs) && effectiveEndIso != null) {
    const formatted = toDisplayDate(effectiveEndIso).toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
    return (
      <div className={cn("text-left", className)}>
        <LabelCaps className="inline-flex items-center gap-2 text-on-surface-variant">
          {showLiveDot ? <LiveDot className="live-dot-pulse h-2 w-2" aria-hidden /> : null}
          {label}
        </LabelCaps>
        <time
          dateTime={effectiveEndIso}
          className="mt-2 block font-headline text-lg font-semibold tabular-nums text-on-surface"
          suppressHydrationWarning
        >
          {formatted}
        </time>
        {secondaryLine ? (
          <p className="mt-2 font-body text-xs text-on-surface-variant">{secondaryLine}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("text-left", className)}>
      <LabelCaps className="inline-flex items-center gap-2 text-on-surface-variant">
        {showLiveDot ? <LiveDot className="live-dot-pulse h-2 w-2" aria-hidden /> : null}
        {label}
      </LabelCaps>

      {ended ? (
        <p className="mt-3 font-body text-sm text-on-surface-variant">This sale has ended</p>
      ) : (
        <>
          <span className="sr-only" aria-live="polite" aria-atomic="true">
            {liveMessage}
          </span>
          <time
            dateTime={effectiveEndIso}
            aria-label={ariaLabel}
            className="mt-3 block"
            suppressHydrationWarning
          >
            <div
              className={cn("grid max-w-xs gap-2", showDays ? "grid-cols-4" : "grid-cols-3")}
              aria-hidden
            >
              {showDays ? (
                <SegmentChip
                  value={segments?.days ?? 0}
                  unit="Days"
                  isLive={showLiveDot}
                  tier={tier}
                  ended={ended}
                  placeholder={placeholder}
                />
              ) : null}
              <SegmentChip
                value={segments?.hours ?? 0}
                unit="Hours"
                isLive={showLiveDot}
                tier={tier}
                ended={ended}
                placeholder={placeholder}
              />
              <SegmentChip
                value={segments?.minutes ?? 0}
                unit="Min"
                isLive={showLiveDot}
                tier={tier}
                ended={ended}
                placeholder={placeholder}
              />
              <SegmentChip
                value={segments?.seconds ?? 0}
                unit="Sec"
                isLive={showLiveDot}
                tier={tier}
                ended={ended}
                placeholder={placeholder}
              />
            </div>
          </time>
        </>
      )}

      {secondaryLine && !ended ? (
        <p className="mt-3 font-body text-xs text-on-surface-variant">{secondaryLine}</p>
      ) : null}
    </div>
  );
}

/** Format a secondary line for hero countdown panels. */
export function formatCountdownSecondaryLine(
  prefix: string,
  iso: string | null | undefined,
): string | null {
  if (!iso) return null;
  const d = toDisplayDate(iso);
  if (Number.isNaN(d.getTime())) return null;
  const formatted = d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return `${prefix} · ${formatted}`;
}
