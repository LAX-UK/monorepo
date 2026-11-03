"use client";

import { useLotCardState } from "@/lib/lot-card/use-lot-card-state";
import {
  type LotLifecycleKind,
  type LotStatusTone,
  type StateLineIcon,
  cardStateLine,
} from "@auction/domain";
import { cn } from "@auction/ui";
import { Check, CircleAlert } from "lucide-react";
import type { ComponentType } from "react";

/** Text colour per tone; the words and the shape carry the meaning too. */
const TONE_TEXT: Readonly<Record<LotStatusTone, string>> = {
  neutral: "text-lax-neutral-fg",
  info: "text-lax-info-fg",
  success: "text-lax-success-fg",
  warning: "text-lax-warning-fg",
  danger: "text-lax-danger-fg",
};

function DotShape({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid place-items-center", className)}>
      <span className="size-2 rounded-full bg-current" />
    </span>
  );
}

const SHAPES: Readonly<Record<StateLineIcon, ComponentType<{ className?: string }>>> = {
  tick: Check,
  alert: CircleAlert,
  dot: DotShape,
};

const MONEY_UNUSED = { money: (amount: string) => amount };

/**
 * How the signed-in bidder stands on a card's lot: "You're leading", "Outbid", "Maximum set".
 * A visitor sees nothing extra. For a signed-in viewer the line's row is reserved from the first
 * paint, so the grid does not move when the reading arrives; lots with no bid leave it empty.
 */
export function LotCardBidderState({
  lotId,
  lifecycle = "live",
  className,
}: {
  lotId: string;
  lifecycle?: LotLifecycleKind;
  className?: string;
}) {
  const { signedIn, loading, state } = useLotCardState(lotId);
  if (!signedIn) return null;

  const line = state
    ? cardStateLine({
        position: state.position,
        lifecycle,
        nextBid: state.nextBidAmount,
        format: MONEY_UNUSED,
      })
    : null;
  const Shape = line ? SHAPES[line.icon] : null;

  return (
    <div
      className={cn(
        "flex min-h-5 items-center gap-1.5 text-lax-13 leading-5 font-medium",
        className,
      )}
      data-testid="lot-card-bidder-state"
      {...(loading ? { "aria-busy": true } : {})}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3 w-24 rounded bg-lax-neutral-bg motion-safe:animate-pulse"
        />
      ) : line ? (
        <span className={cn("inline-flex min-w-0 items-center gap-1.5", TONE_TEXT[line.tone])}>
          {Shape ? <Shape aria-hidden className="size-4 shrink-0" /> : null}
          <span className="min-w-0 truncate">{line.text}</span>
        </span>
      ) : null}
    </div>
  );
}
