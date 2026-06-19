"use client";

import { kycLinkActionLabel } from "@/components/kyc/kyc-copy";
import type { LotTimerState } from "@/components/lot-timer";
import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import {
  type LotBidPosition,
  lotBidPositionAutoStickyLabel,
  lotBidPositionShowOutbidCta,
  lotBidPositionStickyLabel,
} from "@/lib/bid/derive-lot-bid-position";
import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import { useMarketingBidBarChromeRegistration } from "@/lib/context/marketing-bid-bar-chrome";
import { countdownTier } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import type { LotLifecycleKind } from "@/lib/lot/lot-lifecycle";
import { liveUrgencyTextClass } from "@/lib/presenters/status-presentation";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  canShowBidCta,
  isSaleroomLifecycle,
  saleroomStatusLine,
  shouldShowBidStickyMobileBar,
} from "./bid-sticky-mobile-bar.logic";

type Props = {
  live: boolean;
  decision: BidPolicyDecision;
  loginNextPath: string;
  kycFeedback?: import("@/lib/data/dto/dashboard-dtos").KycUserFeedbackDto | null;
  saleRegistrationPath?: string | null;
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
  /** Lot lifecycle kind — saleroom states bypass catalogue countdown. */
  lifecycleKind?: LotLifecycleKind;
  /** Whether this lot is the clerk's on-block lot (hybrid saleroom). */
  isOnBlock?: boolean;
  /** When true, slim bar (countdown only) when bid card is in view. */
  compact?: boolean;
  /** Unified bidder position — drives outbid CTA and auto badge. */
  position?: LotBidPosition | null;
  hasActiveAutoBid?: boolean;
  onFocusManualBid?: () => void;
  onFocusAutoBid?: () => void;
  /** When true, sticky primary action routes to auto-bid instead of manual review. */
  isLeading?: boolean;
  /** Auth-aware CTA for opens-soon state (e.g. watch / notify toggle). */
  upcomingSlot?: ReactNode;
};

function saleRegistrationStickyAction(
  viewId: string,
  saleRegistrationPath: string | null,
  onScrollToBid: () => void,
): ReactNode {
  const ctaClass =
    "shrink-0 rounded-sm bg-cta-bg px-4 py-2 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm";
  const outlineClass =
    "shrink-0 border border-primary/40 px-4 py-2 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary";

  switch (viewId) {
    case "sale-registration-required":
      if (saleRegistrationPath) {
        return (
          <Link href={saleRegistrationPath} className={ctaClass}>
            Register
          </Link>
        );
      }
      return (
        <Button type="button" onClick={onScrollToBid} className={`h-auto ${ctaClass}`}>
          Register
        </Button>
      );
    case "sale-registration-pending":
      return (
        <Button type="button" onClick={onScrollToBid} className={`h-auto ${outlineClass}`}>
          View status
        </Button>
      );
    case "sale-registration-rejected":
      return (
        <Button type="button" onClick={onScrollToBid} className={`h-auto ${outlineClass}`}>
          View registration
        </Button>
      );
    default:
      return null;
  }
}

export function BidStickyMobileBar({
  live,
  decision,
  loginNextPath,
  kycFeedback = null,
  saleRegistrationPath = null,
  step,
  currentPriceLabel,
  priceFlash,
  onScrollToBid,
  remainingLabel,
  msRemaining,
  timerState,
  countdownClock,
  lifecycleKind,
  isOnBlock = false,
  compact = false,
  position = null,
  hasActiveAutoBid = false,
  onFocusManualBid,
  onFocusAutoBid,
  isLeading = false,
  upcomingSlot = null,
}: Props) {
  const outbid = position ? lotBidPositionShowOutbidCta(position) : false;
  const autoBidLabel = position ? lotBidPositionAutoStickyLabel(position, formatMoney) : null;
  const positionLabel = position ? lotBidPositionStickyLabel(position) : null;
  const saleroomMode = isSaleroomLifecycle(lifecycleKind);
  const showBidCta = canShowBidCta(decision);
  const showBar = shouldShowBidStickyMobileBar({ live, lifecycleKind, timerState });

  useMarketingBidBarChromeRegistration(showBar);

  if (!showBar) return null;

  if (timerState.kind === "opensSoon" && !saleroomMode) {
    return <UpcomingBar countdownClock={countdownClock} upcomingSlot={upcomingSlot} />;
  }

  const closeUrgent = !saleroomMode && msRemaining > 0 && countdownTier(msRemaining) !== "normal";

  const statusLine = saleroomMode
    ? saleroomStatusLine(lifecycleKind, isOnBlock)
    : countdownClock || remainingLabel
      ? `Closes ${countdownClock || remainingLabel}`
      : "Closing soon";

  const statusLineClass = saleroomMode
    ? isOnBlock
      ? liveUrgencyTextClass("live")
      : "text-on-surface-variant"
    : closeUrgent
      ? liveUrgencyTextClass("soon")
      : "text-on-surface-variant";

  if (compact) {
    const next = encodeURIComponent(loginNextPath);
    const kycBlocked = decision.kind === "block" && decision.viewId === "kyc-threshold";
    const regBlocked =
      decision.kind === "block" &&
      (decision.viewId === "sale-registration-required" ||
        decision.viewId === "sale-registration-pending" ||
        decision.viewId === "sale-registration-rejected");
    const regAction = regBlocked
      ? saleRegistrationStickyAction(decision.viewId, saleRegistrationPath, onScrollToBid)
      : null;
    return (
      <MarketingStickyBidBar>
        <p
          className={cn(
            "min-w-0 flex-1 text-center font-label text-xs font-semibold uppercase tracking-wider tabular-nums",
            statusLineClass,
          )}
        >
          {statusLine}
        </p>
        {kycBlocked ? (
          <Link
            href={`/dashboard/verify-identity?next=${next}`}
            className="shrink-0 rounded-sm bg-cta-bg px-4 py-2 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm"
          >
            {kycLinkActionLabel(kycFeedback, "short")}
          </Link>
        ) : null}
        {!kycBlocked && regAction}
        {!kycBlocked && !regAction && showBidCta && outbid ? (
          <Button
            type="button"
            onClick={hasActiveAutoBid && onFocusAutoBid ? onFocusAutoBid : onFocusManualBid}
            className="shrink-0 rounded-sm bg-cta-bg px-4 py-2 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm"
          >
            {hasActiveAutoBid ? "Raise max" : "Increase bid"}
          </Button>
        ) : null}
        {!kycBlocked && !regAction && (autoBidLabel || positionLabel) ? (
          <span className="shrink-0 rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 font-label text-[0.65rem] font-bold uppercase tracking-wider text-primary">
            {autoBidLabel ?? positionLabel}
          </span>
        ) : null}
      </MarketingStickyBidBar>
    );
  }

  const next = encodeURIComponent(loginNextPath);

  let right: ReactNode;
  if (decision.kind === "block") {
    switch (decision.viewId) {
      case "not-signed-in":
        right = (
          <Link
            href={`/login?next=${next}`}
            className="shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm"
          >
            Sign in
          </Link>
        );
        break;
      case "staff-no-bid":
        right = (
          <Link
            href="/admin"
            className="shrink-0 border border-outline-variant/40 px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant transition-colors hover:border-link/40 hover:text-link"
          >
            Staff
          </Link>
        );
        break;
      case "seller-own-lot":
      case "suspended":
        right = (
          <span className="shrink-0 px-2 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            {decision.viewId === "seller-own-lot" ? "Your listing" : "Suspended"}
          </span>
        );
        break;
      case "kyc-threshold":
        right = (
          <Link
            href={`/dashboard/verify-identity?next=${next}`}
            className="shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm"
          >
            {kycLinkActionLabel(kycFeedback, "short")}
          </Link>
        );
        break;
      case "sale-registration-required":
      case "sale-registration-pending":
      case "sale-registration-rejected":
        right = saleRegistrationStickyAction(decision.viewId, saleRegistrationPath, onScrollToBid);
        break;
      default:
        right = null;
    }
  } else if (step === 1) {
    if (isLeading && onFocusAutoBid) {
      right = (
        <Button
          type="button"
          onClick={onFocusAutoBid}
          className="h-auto shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm hover:bg-cta-bg/90"
        >
          Raise auto-bid max
        </Button>
      );
    } else if (outbid && (onFocusAutoBid || onFocusManualBid)) {
      right = (
        <Button
          type="button"
          onClick={hasActiveAutoBid && onFocusAutoBid ? onFocusAutoBid : onFocusManualBid}
          className="h-auto shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm hover:bg-cta-bg/90"
        >
          {hasActiveAutoBid ? "Raise auto-bid max" : "Increase bid"}
        </Button>
      );
    } else {
      right = (
        <Button
          type="button"
          onClick={onScrollToBid}
          className="h-auto shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm hover:bg-cta-bg/90"
        >
          Review bid
        </Button>
      );
    }
  } else {
    right = (
      <Button
        type="button"
        variant="outline"
        onClick={onScrollToBid}
        className="h-auto shrink-0 rounded-none border border-primary/40 bg-transparent px-5 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary hover:bg-transparent hover:text-link"
      >
        Confirm bid
      </Button>
    );
  }

  return (
    <MarketingStickyBidBar>
      <div className="min-w-0">
        <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
          Current bid
        </p>
        <p
          className={`truncate font-headline text-lg text-on-surface ${priceFlash ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]" : ""}`}
        >
          {currentPriceLabel}
        </p>
        {autoBidLabel || positionLabel ? (
          <p className="mt-0.5 truncate font-label text-[0.65rem] font-bold uppercase tracking-wider text-secondary">
            {autoBidLabel ?? positionLabel}
          </p>
        ) : null}
        <p
          className={cn(
            "mt-0.5 truncate font-label text-[0.7rem] tabular-nums font-semibold uppercase tracking-wider",
            statusLineClass,
          )}
        >
          {statusLine}
        </p>
      </div>
      {right}
    </MarketingStickyBidBar>
  );
}

/** Pre-sale variant — countdown plus auth-aware notify/watch CTA when provided. */
function UpcomingBar({
  countdownClock,
  upcomingSlot,
}: { countdownClock: string; upcomingSlot?: ReactNode | null }) {
  return (
    <MarketingStickyBidBar>
      <div className="min-w-0">
        <p className="font-label text-[0.7rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-lot-orange">
          Opens in
        </p>
        <p className="truncate font-headline text-lg tabular-nums text-on-surface">
          {countdownClock || "Soon"}
        </p>
      </div>
      {upcomingSlot ? <div className="shrink-0">{upcomingSlot}</div> : null}
    </MarketingStickyBidBar>
  );
}
