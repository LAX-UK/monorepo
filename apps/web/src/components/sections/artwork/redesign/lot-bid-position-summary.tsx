"use client";

import {
  type LotBidPosition,
  lotBidPositionAutoStickyLabel,
} from "@/lib/bid/derive-lot-bid-position";
import { formatMoney } from "@/lib/format-currency";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Gavel, Shield, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  position: LotBidPosition;
  loginNextPath: string;
  onIncreaseBid?: () => void;
  onRaiseAutoBid?: () => void;
  className?: string;
};

function AutoBidLine({ max, step }: { max: string; step: string | null }) {
  return (
    <p className="mt-1 text-sm text-on-surface-variant">
      Auto-bid active to {formatMoney(max)}
      {step ? ` (+${formatMoney(step)} per raise)` : ""}.
    </p>
  );
}

export function LotBidPositionSummary({
  position,
  loginNextPath,
  onIncreaseBid,
  onRaiseAutoBid,
  className,
}: Props) {
  const next = encodeURIComponent(loginNextPath);

  const shell = (tone: "primary" | "error" | "neutral" | "warn", children: ReactNode) => {
    const tones = {
      primary: "border-primary/35 bg-primary-container/15 ring-primary/25 text-on-surface",
      error: "border-error/30 bg-error-container/20 ring-error/20 text-on-surface",
      neutral:
        "border-outline-variant/40 bg-surface-container-high/60 ring-outline-variant/20 text-on-surface",
      warn: "border-lot-orange/30 bg-lot-orange/10 ring-lot-orange/20 text-on-surface",
    };
    return (
      <output
        className={cn(
          "block rounded-lg border px-4 py-3 font-body text-sm ring-1",
          tones[tone],
          className,
        )}
        aria-live="polite"
      >
        {children}
      </output>
    );
  };

  switch (position.kind) {
    case "owner":
      return shell(
        "primary",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            Your listing
          </span>
          <p className="mt-1">
            You&apos;re the seller for this lot. Bidding is disabled; you can follow activity below.
          </p>
        </>,
      );

    case "notSignedIn":
      return shell(
        "neutral",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Sign in to bid
          </span>
          <p className="mt-1 text-on-surface-variant">
            Register or sign in to place bids and set auto-bid on this lot.
          </p>
          <Link
            href={`/login?next=${next}`}
            className="mt-3 inline-flex font-body text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>,
      );

    case "notBidding":
      return shell(
        "neutral",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Your position
          </span>
          <p className="mt-1 text-on-surface-variant">
            You haven&apos;t bid on this lot yet. Set an auto-bid max or place a one-time bid below.
          </p>
        </>,
      );

    case "winning":
      return shell(
        "primary",
        <>
          <span className="inline-flex items-center gap-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            <Gavel className="size-3.5 shrink-0" aria-hidden />
            You&apos;re winning
          </span>
          <p className="mt-1">Your bid is currently the high bid on this lot.</p>
          {position.autoBid ? (
            <AutoBidLine max={position.autoBid.max} step={position.autoBid.step} />
          ) : null}
        </>,
      );

    case "winningByAuto":
      return shell(
        "primary",
        <>
          <span className="inline-flex items-center gap-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            <Shield className="size-3.5 shrink-0" aria-hidden />
            Winning · auto-bid defending
          </span>
          <p className="mt-1">
            You&apos;re the high bidder. We&apos;ll raise by your step if someone outbids you, up to
            your max.
          </p>
          <AutoBidLine max={position.autoBid.max} step={position.autoBid.step} />
        </>,
      );

    case "outbid":
      return shell(
        "error",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-error">
            You&apos;ve been outbid
          </span>
          <p className="mt-1 text-on-surface-variant">
            Another bidder is ahead. Place a higher bid or raise your auto-bid max to retake the
            lead.
          </p>
          {position.autoBid ? (
            <AutoBidLine max={position.autoBid.max} step={position.autoBid.step} />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {onIncreaseBid ? (
              <Button type="button" size="sm" variant="default" onClick={onIncreaseBid}>
                Increase bid
              </Button>
            ) : null}
            {onRaiseAutoBid ? (
              <Button type="button" size="sm" variant="outline" onClick={onRaiseAutoBid}>
                Raise auto-bid max
              </Button>
            ) : null}
          </div>
        </>,
      );

    case "inRunning":
      return shell(
        "warn",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-lot-orange">
            Behind the leader
          </span>
          <p className="mt-1 text-on-surface-variant">
            You&apos;ve bid on this lot but aren&apos;t the high bidder. Bid again or raise your
            auto-bid max.
          </p>
          {position.autoBid ? (
            <AutoBidLine max={position.autoBid.max} step={position.autoBid.step} />
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {onIncreaseBid ? (
              <Button type="button" size="sm" variant="default" onClick={onIncreaseBid}>
                Bid again
              </Button>
            ) : null}
            {onRaiseAutoBid ? (
              <Button type="button" size="sm" variant="outline" onClick={onRaiseAutoBid}>
                Raise auto-bid max
              </Button>
            ) : null}
          </div>
        </>,
      );

    case "won":
      return shell(
        "primary",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary">
            You won
          </span>
          <p className="mt-1">{position.hammerLabel}</p>
          <Link
            href="/dashboard/payments"
            className="mt-2 inline-flex font-body text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            View invoices
          </Link>
        </>,
      );

    case "lost":
      return shell(
        "neutral",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Lot sold
          </span>
          <p className="mt-1 text-on-surface-variant">{position.hammerLabel}</p>
        </>,
      );

    case "noSale":
      return shell(
        "neutral",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            No sale
          </span>
          <p className="mt-1 text-on-surface-variant">
            Reserve was not met — this lot closed without a winning bid.
          </p>
        </>,
      );

    case "cancelled":
      return shell(
        "neutral",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Cancelled
          </span>
          <p className="mt-1 text-on-surface-variant">This lot was cancelled.</p>
        </>,
      );

    case "withdrawn":
      return shell(
        "neutral",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Withdrawn
          </span>
          <p className="mt-1 text-on-surface-variant">This lot was withdrawn from the sale.</p>
        </>,
      );

    case "preLaunch":
      return shell(
        "warn",
        <>
          <span className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-lot-orange">
            Preview
          </span>
          <p className="mt-1 text-on-surface-variant">
            Catalogue preview — online bidding opens when the sale is published.
          </p>
        </>,
      );

    case "scheduled":
      return shell(
        "warn",
        <>
          <span className="inline-flex items-center gap-2 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-lot-orange">
            <Zap className="size-3.5 shrink-0" aria-hidden />
            Opens soon
          </span>
          <p className="mt-1 text-on-surface-variant">
            Bidding isn&apos;t open yet. Set a watchlist reminder or prepare your auto-bid max for
            when the lot goes live.
          </p>
        </>,
      );

    case "endedOther":
      return shell("primary", <p>{position.message}</p>);

    default:
      return null;
  }
}

/** Re-export for sticky bar consumers. */
export { lotBidPositionAutoStickyLabel };
