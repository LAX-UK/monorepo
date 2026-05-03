import type { LotTimerState } from "@/components/lot-timer";
import {
  type CountdownTier,
  countdownTier,
  formatCountdownAriaLabel,
} from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { cn } from "@auction/ui";
import { Clock } from "lucide-react";

type Props = {
  estimateLine: string | null;
  currentPrice: string;
  bidCount: number;
  /** When set, show reserve met / not met next to the current-bid label. */
  reservePrice: string | null;
  /**
   * Lot timer state derived from `classifyLotTimerState` upstream — drives the
   * banner switch between "Closing" (live), "Opens in" (scheduled), and
   * "Closed/Cancelled" (terminal).
   */
  timerState: LotTimerState;
  /** Pre-formatted clock text (HH:MM:SS or `Nd HH:MM:SS`) sized to the timer state. */
  countdownClock: string;
  /** e.g. "Apr 22, 2025, 4:00 PM" — anchor instant in viewer-local time. */
  saleEndLocalLabel: string;
  /** Same, for the start instant on scheduled lots. Falls back to closing label. */
  saleStartLocalLabel?: string;
  /** ISO-8601 instant of scheduled close (for `<time dateTime>`). */
  endAtIso: string;
  /** ISO-8601 instant of scheduled open (for `<time dateTime>` on opens-in banner). */
  startAtIso?: string;
};

/**
 * Three-row bidding header:
 * Row 1 — Estimate · Current bid (with optional reserve badge)
 * Row 2 — State-aware banner: Closing (red, live) / Opens in (amber, scheduled) /
 *          Closed (muted, terminal). Pulse + urgency tier are derived from the
 *          relevant `msLeft`.
 */
export function LotInfoStack({
  estimateLine,
  currentPrice,
  bidCount,
  reservePrice,
  timerState,
  countdownClock,
  saleEndLocalLabel,
  saleStartLocalLabel,
  endAtIso,
  startAtIso,
}: Props) {
  const hasReserve = reservePrice != null && reservePrice !== "";
  const reserveMet = hasReserve
    ? Number.parseFloat(currentPrice) + 1e-9 >= Number.parseFloat(reservePrice ?? "0")
    : null;

  return (
    <div className="w-full max-w-[480px] rounded-lg bg-surface-container-low p-5 dark:bg-surface-container-low/50">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <InfoRow label="Estimate" value={estimateLine ?? "—"} valueClass="text-sm font-medium" />
        <div className="flex flex-col justify-center gap-2.5 sm:text-right">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:justify-end">
            <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
              Current bid ({bidCount} {bidCount === 1 ? "bid" : "bids"})
            </span>
            {hasReserve && reserveMet !== null ? (
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 font-label text-[10px] font-bold uppercase tracking-wide",
                  reserveMet
                    ? "bg-primary-container/40 text-primary"
                    : "bg-surface-container-high text-on-surface-variant",
                )}
              >
                {reserveMet ? "Reserve met" : "Reserve not met"}
              </span>
            ) : null}
          </div>
          <span
            aria-live="polite"
            className="text-2xl font-bold tabular-nums leading-6 text-on-surface"
          >
            {formatMoney(currentPrice)}
          </span>
        </div>
      </div>
      <TimerBanner
        timerState={timerState}
        countdownClock={countdownClock}
        endAtIso={endAtIso}
        startAtIso={startAtIso ?? endAtIso}
        saleEndLocalLabel={saleEndLocalLabel}
        saleStartLocalLabel={saleStartLocalLabel ?? saleEndLocalLabel}
      />
    </div>
  );
}

function InfoRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col justify-center gap-2.5">
      <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </span>
      <span className={cn("tabular-nums leading-5 text-on-surface-variant", valueClass ?? "")}>
        {value}
      </span>
    </div>
  );
}

type TimerBannerProps = {
  timerState: LotTimerState;
  countdownClock: string;
  endAtIso: string;
  startAtIso: string;
  saleEndLocalLabel: string;
  saleStartLocalLabel: string;
};

function TimerBanner({
  timerState,
  countdownClock,
  endAtIso,
  startAtIso,
  saleEndLocalLabel,
  saleStartLocalLabel,
}: TimerBannerProps) {
  switch (timerState.kind) {
    case "live": {
      const tier = countdownTier(timerState.msLeft);
      return (
        <ClosingBanner
          tier={tier}
          countdownClock={countdownClock}
          endAtIso={endAtIso}
          msLeft={timerState.msLeft}
          saleEndLocalLabel={saleEndLocalLabel}
        />
      );
    }
    case "opensSoon":
      return (
        <OpensInBanner
          countdownClock={countdownClock}
          startAtIso={startAtIso}
          msLeft={timerState.msLeft}
          saleStartLocalLabel={saleStartLocalLabel}
        />
      );
    case "closed":
      return <TerminalBanner label="Closed" detail={`Auction closed ${saleEndLocalLabel}`} />;
    case "cancelled":
      return <TerminalBanner label="Cancelled" detail="This lot was cancelled." />;
    case "unknown":
      return null;
    default:
      return null;
  }
}

function ClosingBanner({
  tier,
  countdownClock,
  endAtIso,
  msLeft,
  saleEndLocalLabel,
}: {
  tier: CountdownTier;
  countdownClock: string;
  endAtIso: string;
  msLeft: number;
  saleEndLocalLabel: string;
}) {
  const rowHighlight = tier === "critical";
  return (
    <div
      className={cn(
        "mt-4 flex flex-row items-center gap-2 rounded-lg border border-error/20 bg-error/10 px-4 py-3",
        rowHighlight && "bg-error/15",
      )}
    >
      <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-error">
        Closing in
      </span>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <span className="live-dot-pulse size-1.5 shrink-0 rounded-full bg-error" aria-hidden />
        <time
          dateTime={endAtIso}
          aria-label={formatCountdownAriaLabel(msLeft)}
          className="min-w-0 text-xl font-bold tabular-nums leading-5 text-error"
        >
          {countdownClock}
        </time>
      </div>
      <p className="sr-only">Closes {saleEndLocalLabel}</p>
    </div>
  );
}

function OpensInBanner({
  countdownClock,
  startAtIso,
  msLeft,
  saleStartLocalLabel,
}: {
  countdownClock: string;
  startAtIso: string;
  msLeft: number;
  saleStartLocalLabel: string;
}) {
  return (
    <div className="mt-4 flex flex-row items-center gap-2 rounded-lg border border-lot-orange/30 bg-lot-orange/10 px-4 py-3">
      <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-lot-orange">
        Opens in
      </span>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <Clock className="size-3.5 shrink-0 text-lot-orange" aria-hidden />
        <time
          dateTime={startAtIso}
          aria-label={`Opens in ${countdownClock}`}
          className="min-w-0 text-xl font-bold tabular-nums leading-5 text-lot-orange"
        >
          {countdownClock}
        </time>
      </div>
      <p className="sr-only">
        Bidding opens {saleStartLocalLabel}. {Math.max(0, Math.floor(msLeft / 1000))} seconds
        remaining.
      </p>
    </div>
  );
}

function TerminalBanner({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="mt-4 flex flex-row items-center gap-2 rounded-lg border border-outline-variant/40 bg-surface-container-high/60 px-4 py-3 dark:bg-surface-container-high/30">
      <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </span>
      <span className="ml-auto truncate text-sm font-medium text-on-surface-variant">{detail}</span>
    </div>
  );
}
