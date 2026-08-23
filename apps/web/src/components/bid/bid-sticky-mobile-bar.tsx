"use client";

import { SendVerificationEmailButton } from "@/components/auth/send-verification-email-button";
import type { LotTimerState } from "@/components/lot-timer";
import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { markContextualKycGateNavigation } from "@/components/onboarding/buyer-onboarding-analytics";
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
import type { LotReserveContext } from "@/lib/lot/reserve-presentation";
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
  reserveContext?: LotReserveContext;
  hasActiveAutoBid?: boolean;
  onFocusManualBid?: () => void;
  onFocusAutoBid?: () => void;
  /** When true, sticky primary action routes to auto-bid instead of manual review. */
  isLeading?: boolean;
  /** Auth-aware CTA for opens-soon state (e.g. watch / notify toggle). */
  upcomingSlot?: ReactNode;
};

function bidBlockerStickyAction(
  decision: Extract<BidPolicyDecision, { kind: "block" }>,
  saleRegistrationPath: string | null,
  onScrollToBid: () => void,
  compact: boolean,
  loginNextPath: string,
): ReactNode {
  const action = decision.presentation.action;
  if (!action) return null;

  const padding = compact ? "px-4 py-2 text-[0.65rem]" : "px-5 py-3 text-xs";
  const ctaClass = `shrink-0 rounded-sm bg-cta-bg ${padding} font-label font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm`;
  const outlineClass = `shrink-0 rounded-sm border border-outline-variant/40 bg-surface-container-low ${padding} font-label font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant`;
  const label = action.shortLabel ?? action.label;

  switch (action.kind) {
    case "link":
      return (
        <Link
          href={action.href}
          {...(decision.viewId === "kyc-threshold" || decision.viewId === "strict-kyc-required"
            ? { onClick: () => markContextualKycGateNavigation("bid_gate", loginNextPath) }
            : {})}
          className={ctaClass}
        >
          {label}
        </Link>
      );
    case "email":
      return (
        <SendVerificationEmailButton
          email={action.email}
          next={action.next}
          label={label}
          variant="default"
          className={`h-auto ${ctaClass}`}
        />
      );
    case "panel":
      if (saleRegistrationPath) {
        return (
          <Link href={saleRegistrationPath} className={ctaClass}>
            {label}
          </Link>
        );
      }
      return (
        <Button type="button" onClick={onScrollToBid} className={`h-auto ${ctaClass}`}>
          {label}
        </Button>
      );
    case "status":
      return (
        <span
          className={outlineClass}
          aria-label={`${decision.presentation.title}: ${action.label}`}
        >
          {label}
        </span>
      );
  }
}

export function BidStickyMobileBar({
  live,
  decision,
  loginNextPath,
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
  reserveContext,
  hasActiveAutoBid = false,
  onFocusManualBid,
  onFocusAutoBid,
  isLeading = false,
  upcomingSlot = null,
}: Props) {
  const outbid = position ? lotBidPositionShowOutbidCta(position) : false;
  const autoBidLabel = position ? lotBidPositionAutoStickyLabel(position, formatMoney) : null;
  const positionLabel = position ? lotBidPositionStickyLabel(position, reserveContext) : null;
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
    const blockerAction =
      decision.kind === "block"
        ? bidBlockerStickyAction(decision, saleRegistrationPath, onScrollToBid, true, loginNextPath)
        : null;
    return (
      <MarketingStickyBidBar>
        <p
          className={cn(
            "min-w-0 flex-1 text-center font-label text-xs font-semibold uppercase tracking-wider tabular-nums",
            statusLineClass,
          )}
        >
          {decision.kind === "block" ? decision.presentation.title : statusLine}
        </p>
        {blockerAction}
        {decision.kind !== "block" && showBidCta && outbid ? (
          <Button
            type="button"
            onClick={hasActiveAutoBid && onFocusAutoBid ? onFocusAutoBid : onFocusManualBid}
            className="shrink-0 rounded-sm bg-cta-bg px-4 py-2 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm"
          >
            {hasActiveAutoBid ? "Raise max" : "Increase bid"}
          </Button>
        ) : null}
        {decision.kind !== "block" && (autoBidLabel || positionLabel) ? (
          <span className="shrink-0 rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 font-label text-[0.65rem] font-bold uppercase tracking-wider text-primary">
            {autoBidLabel ?? positionLabel}
          </span>
        ) : null}
      </MarketingStickyBidBar>
    );
  }

  let right: ReactNode;
  if (decision.kind === "block") {
    right = bidBlockerStickyAction(
      decision,
      saleRegistrationPath,
      onScrollToBid,
      false,
      loginNextPath,
    );
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
        {decision.kind === "block" ? (
          <p className="mt-0.5 truncate font-label text-[0.65rem] font-bold uppercase tracking-wider text-secondary">
            {decision.presentation.title}
          </p>
        ) : autoBidLabel || positionLabel ? (
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
