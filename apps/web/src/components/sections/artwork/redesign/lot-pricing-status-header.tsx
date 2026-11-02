"use client";

import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { ParticipationWarningBadge } from "@/components/ui/participation-warning-badge";
import { formatMoney } from "@/lib/format-currency";
import type { LotLifecycle } from "@/lib/lot/lot-lifecycle";
import { lotLifecycleIsClosed, lotPriceLabel } from "@/lib/lot/lot-price-label";
import type { LotReserveContext } from "@/lib/lot/reserve-presentation";
import { reserveBadgeLabel } from "@/lib/lot/reserve-presentation";
import { countdownTone, countdownToneClass } from "@/lib/presenters/countdown-tone";
import { cn } from "@auction/ui";

type Props = {
  seed: LotSummarySeedVM;
  currentPrice: string;
  /** Whether anyone has bid: until then the figure is the starting bid. */
  hasBids: boolean;
  minNextBid: string;
  lotNumber?: number | null;
  reserveContext: LotReserveContext;
  lifecycle: LotLifecycle;
  countdownClock: string;
  /** When anti-snipe extended the clock. */
  extendedByMs?: number | null;
  className?: string;
};

export function LotPricingStatusHeader({
  seed,
  currentPrice,
  hasBids,
  minNextBid,
  lotNumber,
  reserveContext,
  lifecycle,
  countdownClock,
  extendedByMs = null,
  className,
}: Props) {
  const badge = reserveBadgeLabel(reserveContext.reserveMet, reserveContext.hasReserve);
  const showBadge =
    badge != null && lifecycle.kind !== "endedNoSale" && lifecycle.kind !== "endedSold";
  const live = lifecycle.kind === "live" || lifecycle.kind === "extended";
  const scheduled = lifecycle.kind === "scheduled";
  const showTimingColumn = live || scheduled;
  const price = lotPriceLabel(lifecycle.kind, hasBids);

  return (
    <div className={cn("mb-4 border-b border-outline-variant/30 pb-4", className)}>
      <h2 className="font-body text-lg font-medium leading-tight text-on-surface">
        {lotNumber != null ? `${lotNumber}. ` : ""}
        {seed.title}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div>
          <p className="font-label text-xs font-medium text-on-surface-variant">Estimate</p>
          <p className="mt-0.5 font-body text-sm font-medium text-on-surface">
            {seed.estimateLine ?? "—"}
          </p>
        </div>
        <div>
          <div className="flex flex-wrap items-baseline gap-1.5">
            <p className="font-label text-xs font-medium text-on-surface-variant">{price.label}</p>
            {showBadge ? (
              <span
                className={cn(
                  "rounded-sm px-1 py-0.5 font-label text-xs font-medium",
                  reserveContext.reserveMet
                    ? "bg-primary-container/40 text-primary"
                    : "bg-surface-container-high text-on-surface-variant",
                )}
              >
                {badge}
              </span>
            ) : null}
          </div>
          <p
            className="mt-0.5 font-body text-sm font-semibold tabular-nums text-on-surface"
            aria-live="polite"
          >
            {price.value.kind === "amount" ? formatMoney(currentPrice) : price.value.text}
          </p>
        </div>
        {showTimingColumn ? (
          <div className="col-span-2 sm:col-span-1">
            <p className="font-label text-xs font-medium text-on-surface-variant">
              {scheduled
                ? "Opens in"
                : lifecycle.kind === "extended"
                  ? "Extended · closes"
                  : "Closing in"}
            </p>
            <p
              className={cn(
                "mt-0.5 font-body text-sm font-bold tabular-nums",
                live
                  ? countdownToneClass(
                      countdownTone(lifecycle.msLeft ?? 0, {
                        extended: lifecycle.kind === "extended",
                      }),
                    )
                  : "text-on-surface",
              )}
            >
              {countdownClock || "—"}
            </p>
            {extendedByMs != null && extendedByMs > 0 ? (
              <ParticipationWarningBadge
                kind="antiSnipeExtended"
                extendedSeconds={Math.round(extendedByMs / 1000)}
                className="mt-1 normal-case"
              />
            ) : null}
          </div>
        ) : lotLifecycleIsClosed(lifecycle.kind) ? null : (
          <div>
            <p className="font-label text-xs font-medium text-on-surface-variant">Min. next bid</p>
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
