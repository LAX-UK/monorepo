"use client";

import type { LotTimerState } from "@/components/lot-timer";
import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import { countdownTier } from "@/lib/format-countdown";
import { cn } from "@auction/ui";
import { StickyBidBar } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  live: boolean;
  decision: BidPolicyDecision;
  loginNextPath: string;
  step: 1 | 2;
  currentPriceLabel: string;
  priceFlash: boolean;
  onScrollToBid: () => void;
  /** Same label as the lot info stack “Closing” row. */
  remainingLabel: string;
  /** ms until close (for urgency color on the timer line). */
  msRemaining: number;
  /** Computed timer state — drives the live / opens-in / closed variants. */
  timerState: LotTimerState;
  /** Pre-formatted clock for the countdown (HH:MM:SS or `Nd HH:MM:SS`). */
  countdownClock: string;
};

export function BidStickyMobileBar({
  live,
  decision,
  loginNextPath,
  step,
  currentPriceLabel,
  priceFlash,
  onScrollToBid,
  remainingLabel,
  msRemaining,
  timerState,
  countdownClock,
}: Props) {
  if (timerState.kind === "opensSoon") {
    return <UpcomingBar countdownClock={countdownClock} loginNextPath={loginNextPath} />;
  }
  if (timerState.kind === "closed" || timerState.kind === "cancelled") {
    return <ClosedBar terminalLabel={timerState.kind === "closed" ? "Closed" : "Cancelled"} />;
  }
  if (!live) return null;

  const next = encodeURIComponent(loginNextPath);
  const closeUrgent = countdownTier(msRemaining) !== "normal";

  let right: ReactNode;
  if (decision.kind === "block") {
    switch (decision.viewId) {
      case "not-signed-in":
        right = (
          <Link
            href={`/login?next=${next}`}
            className="shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-cta-on shadow-sm"
          >
            Sign in
          </Link>
        );
        break;
      case "staff-no-bid":
        right = (
          <Link
            href="/admin"
            className="shrink-0 border border-outline-variant/40 px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant transition-colors hover:border-primary/40 hover:text-primary"
          >
            Staff
          </Link>
        );
        break;
      case "seller-own-lot":
      case "suspended":
        right = (
          <span className="shrink-0 px-2 py-3 font-label text-[0.65rem] font-bold uppercase tracking-widest text-on-surface-variant">
            {decision.viewId === "seller-own-lot" ? "Your listing" : "Suspended"}
          </span>
        );
        break;
      default:
        right = null;
    }
  } else if (step === 1) {
    right = (
      <Button
        type="button"
        onClick={onScrollToBid}
        className="h-auto shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-cta-on shadow-sm hover:bg-cta-bg/90"
      >
        Place bid
      </Button>
    );
  } else {
    right = (
      <Button
        type="button"
        variant="outline"
        onClick={onScrollToBid}
        className="h-auto shrink-0 rounded-none border border-primary/40 bg-transparent px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-primary hover:bg-transparent hover:text-primary"
      >
        Confirm bid
      </Button>
    );
  }

  return (
    <StickyBidBar className="lg:hidden">
      <div className="min-w-0">
        <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
          Current bid
        </p>
        <p
          className={`truncate font-headline text-lg text-on-surface ${priceFlash ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]" : ""}`}
        >
          {currentPriceLabel}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate font-label text-[0.7rem] tabular-nums font-semibold uppercase tracking-wider",
            closeUrgent ? "text-error" : "text-on-surface-variant",
          )}
        >
          Closes {remainingLabel}
        </p>
      </div>
      {right}
    </StickyBidBar>
  );
}

/** Pre-sale variant — invites visitors to register so they can bid the moment
 * the lot opens. Bidding controls are intentionally absent (no live bid yet).
 */
function UpcomingBar({
  countdownClock,
  loginNextPath,
}: { countdownClock: string; loginNextPath: string }) {
  const next = encodeURIComponent(loginNextPath);
  return (
    <StickyBidBar className="lg:hidden">
      <div className="min-w-0">
        <p className="font-label text-[0.7rem] font-bold uppercase tracking-widest text-lot-orange">
          Opens in
        </p>
        <p className="truncate font-headline text-lg tabular-nums text-on-surface">
          {countdownClock}
        </p>
      </div>
      <Link
        href={`/register?next=${next}`}
        className="shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-cta-on shadow-sm"
      >
        Register
      </Link>
    </StickyBidBar>
  );
}

function ClosedBar({ terminalLabel }: { terminalLabel: "Closed" | "Cancelled" }) {
  return (
    <StickyBidBar className="lg:hidden">
      <div className="min-w-0">
        <p className="font-label text-[0.7rem] font-bold uppercase tracking-widest text-on-surface-variant">
          Auction
        </p>
        <p className="truncate font-headline text-lg text-on-surface">{terminalLabel}</p>
      </div>
      <span className="font-label text-[0.7rem] font-bold uppercase tracking-widest text-on-surface-variant">
        Bidding ended
      </span>
    </StickyBidBar>
  );
}
