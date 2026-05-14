import { maskPaddleFromBidderId } from "@/components/sections/artwork/artwork-view-models";
import {
  type CountdownTier,
  countdownTier,
  formatCountdownAriaLabel,
} from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import { cn } from "@auction/ui";
import { Clock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  estimateLine: string | null;
  currentPrice: string;
  bidCount: number;
  /** When set, show reserve met / not met next to the current-bid label. */
  reservePrice: string | null;
  /** Unified lifecycle from `classifyLotLifecycle` — drives banners. */
  lifecycle: LotLifecycle;
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
  /** Signed-in user — used for "You won" vs hammer copy on `endedSold`. */
  currentUserId?: string | null;
  /** Placed under scheduled opens banner — e.g. watchlist toggle. */
  scheduledNotifySlot?: ReactNode;
  /** Shown when lifecycle is `endedNoSale` — e.g. watchlist for relist interest. */
  endedNoSaleNotifySlot?: ReactNode;
};

/** Three-row bidding header:
 * Row 1 — Estimate · Current bid (with optional reserve badge)
 * Row 2 — State-aware banner from `LotLifecycle`.
 */
export function LotInfoStack({
  estimateLine,
  currentPrice,
  bidCount,
  reservePrice,
  lifecycle,
  countdownClock,
  saleEndLocalLabel,
  saleStartLocalLabel,
  endAtIso,
  startAtIso,
  currentUserId = null,
  scheduledNotifySlot,
  endedNoSaleNotifySlot,
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
      <LifecycleBanner
        lifecycle={lifecycle}
        currentPrice={currentPrice}
        currentUserId={currentUserId}
        countdownClock={countdownClock}
        endAtIso={endAtIso}
        startAtIso={startAtIso ?? endAtIso}
        saleEndLocalLabel={saleEndLocalLabel}
        saleStartLocalLabel={saleStartLocalLabel ?? saleEndLocalLabel}
        scheduledNotifySlot={scheduledNotifySlot}
        endedNoSaleNotifySlot={endedNoSaleNotifySlot}
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

type LifecycleBannerProps = {
  lifecycle: LotLifecycle;
  currentPrice: string;
  currentUserId: string | null;
  countdownClock: string;
  endAtIso: string;
  startAtIso: string;
  saleEndLocalLabel: string;
  saleStartLocalLabel: string;
  scheduledNotifySlot?: ReactNode;
  endedNoSaleNotifySlot?: ReactNode;
};

function LifecycleBanner({
  lifecycle,
  currentPrice,
  currentUserId,
  countdownClock,
  endAtIso,
  startAtIso,
  saleEndLocalLabel,
  saleStartLocalLabel,
  scheduledNotifySlot,
  endedNoSaleNotifySlot,
}: LifecycleBannerProps) {
  switch (lifecycle.kind) {
    case "live":
    case "extended": {
      const ms = lifecycle.msLeft ?? 0;
      const tier = countdownTier(ms);
      return (
        <ClosingBanner
          tier={tier}
          countdownClock={countdownClock}
          endAtIso={endAtIso}
          msLeft={ms}
          saleEndLocalLabel={saleEndLocalLabel}
          extended={lifecycle.kind === "extended"}
        />
      );
    }
    case "scheduled":
      return (
        <OpensInBanner
          countdownClock={countdownClock}
          startAtIso={startAtIso}
          msLeft={lifecycle.msLeft ?? 0}
          saleStartLocalLabel={saleStartLocalLabel}
          notifySlot={scheduledNotifySlot}
        />
      );
    case "endedSold":
      return (
        <EndedSoldBanner
          hammer={formatMoney(currentPrice)}
          winnerId={lifecycle.winnerId ?? null}
          currentUserId={currentUserId}
          saleEndLocalLabel={saleEndLocalLabel}
        />
      );
    case "endedNoSale":
      return (
        <div className="mt-4 space-y-3">
          <TerminalBanner
            label="No sale"
            detail="Reserve was not met — this lot closed without a winning bid."
          />
          {endedNoSaleNotifySlot ? (
            <div className="rounded-lg border border-outline-variant/30 bg-surface-container-high/40 px-4 py-3 dark:bg-surface-container-high/20">
              <p className="mb-2 font-body text-xs text-on-surface-variant">
                Want a second chance? Save the lot — we&apos;ll email you if it is relisted.
              </p>
              {endedNoSaleNotifySlot}
            </div>
          ) : null}
        </div>
      );
    case "cancelled":
      return <TerminalBanner label="Cancelled" detail="This lot was cancelled." />;
    case "withdrawn":
      return <TerminalBanner label="Withdrawn" detail="This lot was withdrawn from the sale." />;
    case "preLaunch":
      return (
        <TerminalBanner
          label="Preview"
          detail="Catalogue preview — online bidding opens when the sale is published."
        />
      );
  }
}

function ClosingBanner({
  tier,
  countdownClock,
  endAtIso,
  msLeft,
  saleEndLocalLabel,
  extended,
}: {
  tier: CountdownTier;
  countdownClock: string;
  endAtIso: string;
  msLeft: number;
  saleEndLocalLabel: string;
  extended: boolean;
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
        {extended ? "Extended · closing in" : "Closing in"}
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
      <p className="sr-only">
        Closes {saleEndLocalLabel}.{" "}
        {extended
          ? "Closing time was extended because a bid arrived near the original end time."
          : "Anti-snipe may extend closing time if bids arrive near the end."}
      </p>
    </div>
  );
}

function OpensInBanner({
  countdownClock,
  startAtIso,
  msLeft,
  saleStartLocalLabel,
  notifySlot,
}: {
  countdownClock: string;
  startAtIso: string;
  msLeft: number;
  saleStartLocalLabel: string;
  notifySlot?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-lot-orange/30 bg-lot-orange/10 px-4 py-3">
      <div className="flex flex-row items-center gap-2">
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
      </div>
      <p className="sr-only">
        Bidding opens {saleStartLocalLabel}. {Math.max(0, Math.floor(msLeft / 1000))} seconds
        remaining.
      </p>
      {notifySlot ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-lot-orange/25 pt-3">
          <p className="w-full font-body text-xs text-lot-orange/90">
            Get a reminder before the room opens — no payment until you bid.
          </p>
          {notifySlot}
        </div>
      ) : null}
    </div>
  );
}

function EndedSoldBanner({
  hammer,
  winnerId,
  currentUserId,
  saleEndLocalLabel,
}: {
  hammer: string;
  winnerId: string | null;
  currentUserId: string | null;
  saleEndLocalLabel: string;
}) {
  const youWon = Boolean(currentUserId && winnerId && currentUserId === winnerId);
  const paddle = winnerId ? maskPaddleFromBidderId(winnerId) : null;

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-primary/25 bg-primary-container/10 px-4 py-3 ring-1 ring-primary/15 dark:bg-primary/10">
      <span className="font-label text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
        Sold
      </span>
      {youWon ? (
        <div className="space-y-2">
          <p className="font-body text-sm font-medium text-on-surface">
            You won this lot — hammer {hammer}.
          </p>
          <Link
            href="/dashboard/payments"
            className="inline-flex font-body text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            View invoices
          </Link>
        </div>
      ) : (
        <p className="font-body text-sm text-on-surface">
          Hammer {hammer}
          {paddle ? (
            <>
              {" "}
              · sold to <span className="font-medium tabular-nums">{paddle}</span>
            </>
          ) : null}
          . <span className="text-on-surface-variant">Closed {saleEndLocalLabel}.</span>
        </p>
      )}
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
