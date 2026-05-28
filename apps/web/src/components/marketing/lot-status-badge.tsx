"use client";

import { LotCardTimer, type LotCardTimerProps } from "@/components/lot-timer";
/**
 * Unified lot timing / status for marketing + saleroom.
 * Prefer `LotStatusBadge` (compact pill) and `LotStatusTimer` (card / overlay countdown).
 *
 * @see docs/marketing-design-language.md
 */
import { type LotTimerInputs, classifyLotTimerState } from "@/components/lot-timer/classify";
import { formatRemaining } from "@/components/lot-timer/format";
import { useNow } from "@/hooks/use-now";
import { LiveBadge, StatusBadge, cn } from "@auction/ui";

export { LotCardTimer as LotStatusTimer, LotCardTimer, type LotCardTimerProps };

const pillLabelClass =
  "font-label text-[length:var(--text-label-1)] font-semibold uppercase tracking-wider";

type LotStatusBadgeProps = LotTimerInputs & {
  /** Fallback line when timer state is unknown (e.g. draft). */
  closingShort?: string | null;
};

/** Compact inline lot status — live / opens soon / closed / cancelled + optional fallback. */
export function LotStatusBadge({ closingShort, ...inputs }: LotStatusBadgeProps) {
  const now = useNow(1000);
  const state = classifyLotTimerState(inputs, now);

  if (state.kind === "live") {
    const clock = formatRemaining(state.msLeft);
    return (
      <span className="inline-flex max-w-full items-center gap-1.5">
        <LiveBadge />
        <span className={cn(pillLabelClass, "tabular-nums font-medium normal-case text-live-red")}>
          {clock}
        </span>
      </span>
    );
  }

  if (state.kind === "opensSoon") {
    const clock = formatRemaining(state.msLeft);
    return (
      <StatusBadge variant="info" size="sm" className="max-w-full normal-case">
        Opens in <span className="ml-1 tabular-nums">{clock}</span>
      </StatusBadge>
    );
  }

  if (state.kind === "closed") {
    return (
      <StatusBadge variant="neutral" size="sm">
        Closed
      </StatusBadge>
    );
  }

  if (state.kind === "cancelled") {
    return (
      <StatusBadge variant="neutral" size="sm">
        Cancelled
      </StatusBadge>
    );
  }

  if (closingShort?.trim()) {
    return (
      <StatusBadge variant="neutral" size="sm" className="max-w-full normal-case">
        <span className="truncate">{closingShort}</span>
      </StatusBadge>
    );
  }

  return null;
}
