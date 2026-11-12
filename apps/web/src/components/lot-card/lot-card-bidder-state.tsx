"use client";

import { useLotCardState } from "@/lib/lot-card/use-lot-card-state";
import { formatLotMoney } from "@/lib/lot-page/lot-money";
import {
  type LotLifecycleKind,
  type LotStatusTone,
  type StateLineIcon,
  cardStateLine,
} from "@auction/domain";
import { ButtonLink } from "@auction/ui/lax/button-link";
import { cn } from "@auction/ui/lib/utils";
import { Check, CircleAlert } from "lucide-react";
import Link from "next/link";
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

const MONEY = { money: (amount: string) => formatLotMoney(amount) };

/** The lot page with its bid dialog open; the page re-checks every rule before it opens. */
export function lotBidHref(lotHref: string): string {
  return `${lotHref}${lotHref.includes("?") ? "&" : "?"}bid=open`;
}

/**
 * How the signed-in bidder stands on a card's lot: "You're leading", "Outbid", "Maximum set".
 * A visitor sees nothing extra. For a signed-in viewer the line's row is reserved from the first
 * paint, so the grid does not move when the reading arrives; lots with no bid leave it empty.
 *
 * An outbid bidder on a lot that is still open also gets "Bid £X" when the card knows its lot
 * page. The button goes to the lot page with the bid dialog open rather than bidding from the
 * card: the card's reading can be 15 seconds old and has no registration, suspension, extended
 * close or live price, which the lot page holds and the one bid dialog needs.
 */
export function LotCardBidderState({
  lotId,
  lifecycle = "live",
  lotHref,
  lotTitle,
  className,
}: {
  lotId: string;
  /** The lot page; without it the card names the standing but offers no button. */
  lotHref?: string;
  lotTitle?: string;
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
        format: MONEY,
      })
    : null;
  const Shape = line ? SHAPES[line.icon] : null;

  const bid = lotHref && line?.action ? { ...line.action, href: lotBidHref(lotHref) } : null;

  return (
    <div
      className={cn(
        "flex min-h-5 flex-wrap items-center gap-x-3 gap-y-1.5 text-lax-13 leading-5 font-medium",
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
      {!loading && bid ? (
        <ButtonLink
          href={bid.href}
          Link={Link}
          variant="primary"
          size="lg"
          className="relative z-[2]"
          {...(lotTitle ? { "aria-label": `${bid.label} on ${lotTitle}` } : {})}
        >
          {bid.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
