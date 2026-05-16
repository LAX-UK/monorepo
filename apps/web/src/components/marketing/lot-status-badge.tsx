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
import { cn } from "@auction/ui";

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
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100",
          pillLabelClass,
        )}
      >
        <span
          className="size-1.5 shrink-0 rounded-full bg-red-600 motion-safe:animate-pulse"
          aria-hidden
        />
        Live
        <span className="tabular-nums font-medium normal-case">{clock}</span>
      </span>
    );
  }

  if (state.kind === "opensSoon") {
    const clock = formatRemaining(state.msLeft);
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center rounded-full border border-neutral-300 bg-neutral-100 text-neutral-800 dark:border-outline dark:bg-surface-container-high dark:text-on-surface-variant",
          pillLabelClass,
          "px-2 py-0.5",
        )}
      >
        Opens in <span className="ml-1 tabular-nums normal-case">{clock}</span>
      </span>
    );
  }

  if (state.kind === "closed") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface-variant",
          pillLabelClass,
          "px-2 py-0.5",
        )}
      >
        Closed
      </span>
    );
  }

  if (state.kind === "cancelled") {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface-variant",
          pillLabelClass,
          "px-2 py-0.5",
        )}
      >
        Cancelled
      </span>
    );
  }

  if (closingShort?.trim()) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface-variant",
          pillLabelClass,
          "px-2 py-0.5",
        )}
      >
        <span className="truncate normal-case">{closingShort}</span>
      </span>
    );
  }

  return null;
}
