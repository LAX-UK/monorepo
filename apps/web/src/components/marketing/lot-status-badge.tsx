"use client";

import { LotCardTimer, type LotCardTimerProps } from "@/components/lot-timer";
/**
 * Unified lot timing / status for marketing + saleroom.
 * Prefer `LotStatusBadge` (compact pill) and `LotStatusTimer` (card / overlay countdown).
 *
 * @see docs/marketing-design-language.md
 */
import {
  type LotTimerInputs,
  classifyLotTimerState,
  lotTimerMoments,
} from "@/components/lot-timer/classify";
import { timerText } from "@/components/lot-timer/format";
import { toPublicStatusBadgeProps } from "@/lib/presenters/public-status-badge";
import {
  liveStatusCountdownClassName,
  resolveLotStatusPresentation,
} from "@/lib/presenters/status-presentation";
import { useCountdownTick } from "@/lib/time/use-clock";
import { LiveBadge } from "@auction/ui/components/live-badge";
import { StatusBadge } from "@auction/ui/components/status-badge";

export { LotCardTimer as LotStatusTimer, LotCardTimer, type LotCardTimerProps };

type LotStatusBadgeProps = LotTimerInputs & {
  /** API winner — drives Sold vs Unsold when status is `ended`. */
  winnerId?: string | null | undefined;
  /** List-row sold flag when buyer id is omitted from public summaries. */
  hasWinner?: boolean;
  /** The result is not final yet: the badge says Ended. */
  resultPending?: boolean | undefined;
};

/** Compact inline lot status — live / opens soon / API status + optional countdown. */
export function LotStatusBadge({
  winnerId,
  hasWinner,
  resultPending,
  ...inputs
}: LotStatusBadgeProps) {
  const now = useCountdownTick(lotTimerMoments(inputs), { surface: "card" });
  const state = classifyLotTimerState(inputs, now);

  if (state.kind === "live" && now != null) {
    const { words, date } = timerText(state.msLeft, now);
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap">
        <LiveBadge />
        <span className={liveStatusCountdownClassName}>{date ? `Ends ${date}` : words}</span>
      </span>
    );
  }

  if (state.kind === "opensSoon" && now != null) {
    const { words, date } = timerText(state.msLeft, now);
    return (
      <StatusBadge tone="info">
        <span className="whitespace-nowrap tabular-nums">
          {date ? `Opens ${date}` : `Opens in ${words}`}
        </span>
      </StatusBadge>
    );
  }

  if (state.kind === "closed" || state.kind === "cancelled" || state.kind === "unknown") {
    const presentation = resolveLotStatusPresentation(inputs.status, {
      ...(winnerId !== undefined ? { winnerId } : {}),
      ...(hasWinner !== undefined ? { hasWinner } : {}),
      ...(resultPending ? { resultPending } : {}),
    });
    return (
      <StatusBadge {...toPublicStatusBadgeProps(presentation)}>{presentation.label}</StatusBadge>
    );
  }

  return null;
}
