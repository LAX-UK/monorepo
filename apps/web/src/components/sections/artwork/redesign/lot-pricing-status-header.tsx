"use client";

import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { formatMoney } from "@/lib/format-currency";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import { cn } from "@auction/ui";

type Props = {
  seed: LotSummarySeedVM;
  currentPrice: string;
  minNextBid: string;
  lotNumber?: number | null;
  reservePrice: string | null;
  lifecycle: LotLifecycle;
  countdownClock: string;
  /** When anti-snipe extended the clock. */
  extendedByMs?: number | null;
  className?: string;
};

function reserveMet(currentPrice: string, reservePrice: string | null): boolean | null {
  if (reservePrice == null || reservePrice === "") return null;
  return Number.parseFloat(currentPrice) + 1e-9 >= Number.parseFloat(reservePrice);
}

export function LotPricingStatusHeader({
  seed,
  currentPrice,
  minNextBid,
  lotNumber,
  reservePrice,
  lifecycle,
  countdownClock,
  extendedByMs = null,
  className,
}: Props) {
  const met = reserveMet(currentPrice, reservePrice);
  const live = lifecycle.kind === "live" || lifecycle.kind === "extended";
  const scheduled = lifecycle.kind === "scheduled";

  return (
    <div className={cn("mb-4 border-b border-outline-variant/30 pb-4", className)}>
      <h2 className="font-body text-lg font-medium leading-tight text-on-surface">
        {lotNumber != null ? `${lotNumber}. ` : ""}
        {seed.title}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
            Estimate
          </p>
          <p className="mt-0.5 font-body text-sm font-medium text-on-surface">
            {seed.estimateLine ?? "—"}
          </p>
        </div>
        <div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              {lifecycle.kind === "endedSold" || lifecycle.kind === "endedNoSale"
                ? "Final bid"
                : "Current bid"}
            </p>
            {met !== null ? (
              <span
                className={cn(
                  "rounded-sm px-1 py-0.5 font-label text-[9px] font-bold uppercase tracking-wide",
                  met
                    ? "bg-primary-container/40 text-primary"
                    : "bg-surface-container-high text-on-surface-variant",
                )}
              >
                {met ? "Reserve met" : "Reserve not met"}
              </span>
            ) : null}
          </div>
          <p
            className="mt-0.5 font-body text-sm font-semibold tabular-nums text-on-surface"
            aria-live="polite"
          >
            {formatMoney(currentPrice)}
          </p>
        </div>
        {live || scheduled ? (
          <div className="col-span-2 sm:col-span-1">
            <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              {scheduled
                ? "Opens in"
                : lifecycle.kind === "extended"
                  ? "Extended · closes"
                  : "Closing in"}
            </p>
            <p
              className={cn(
                "mt-0.5 font-body text-sm font-bold tabular-nums",
                live ? "text-error" : "text-lot-orange",
              )}
            >
              {countdownClock || "—"}
            </p>
            {extendedByMs != null && extendedByMs > 0 ? (
              <p className="mt-1 font-label text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                +{Math.max(1, Math.round(extendedByMs / 1000))}s anti-snipe
              </p>
            ) : null}
          </div>
        ) : (
          <div>
            <p className="font-label text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
              Min. next bid
            </p>
            <p className="mt-0.5 font-body text-sm font-medium tabular-nums text-on-surface">
              {formatMoney(minNextBid)}
            </p>
          </div>
        )}
      </div>
      {live ? (
        <p className="mt-2 font-body text-xs text-on-surface-variant">
          Next minimum bid {formatMoney(minNextBid)}
        </p>
      ) : null}
    </div>
  );
}
