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
import {
  liveStatusCountdownClassName,
  resolveLotStatusPresentation,
} from "@/lib/presenters/status-presentation";
import { LiveBadge, StatusBadge } from "@auction/ui";

export { LotCardTimer as LotStatusTimer, LotCardTimer, type LotCardTimerProps };

type LotStatusBadgeProps = LotTimerInputs & {
  /** API winner — drives Sold vs Unsold when status is `ended`. */
  winnerId?: string | null | undefined;
  /** List-row sold flag when buyer id is omitted from public summaries. */
  hasWinner?: boolean;
};

/** Compact inline lot status — live / opens soon / API status + optional countdown. */
export function LotStatusBadge({ winnerId, hasWinner, ...inputs }: LotStatusBadgeProps) {
  const now = useNow(1000);
  const state = classifyLotTimerState(inputs, now);

  if (state.kind === "live") {
    const clock = formatRemaining(state.msLeft);
    return (
      <span className="inline-flex max-w-full items-center gap-1.5">
        <LiveBadge />
        <span className={liveStatusCountdownClassName}>{clock}</span>
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

  if (state.kind === "closed" || state.kind === "cancelled" || state.kind === "unknown") {
    const presentation = resolveLotStatusPresentation(inputs.status, {
      ...(winnerId !== undefined ? { winnerId } : {}),
      ...(hasWinner !== undefined ? { hasWinner } : {}),
    });
    return (
      <StatusBadge
        variant={presentation.variant}
        size="sm"
        {...(presentation.dot ? { dot: true } : {})}
        className="max-w-full normal-case"
      >
        <span className="truncate">{presentation.label}</span>
      </StatusBadge>
    );
  }

  return null;
}
