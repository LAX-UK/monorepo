"use client";

import { SendVerificationEmailButton } from "@/components/auth/send-verification-email-button";
import type { LotTimerState } from "@/components/lot-timer";
import { MarketingStickyBidBar } from "@/components/marketing/marketing-sticky-bid-bar";
import { markContextualKycGateNavigation } from "@/components/onboarding/buyer-onboarding-analytics";
import type { BidBlockerAction } from "@/lib/bid/bid-blocker-presentation";
import {
  type LotBidPosition,
  lotBidPositionAutoStickyLabel,
  lotBidPositionShowOutbidCta,
  lotBidPositionStickyLabel,
} from "@/lib/bid/derive-lot-bid-position";
import type { BidPolicyDecision } from "@/lib/bid/policies/types";
import {
  bidBlockerStickyAction,
  bidBlockerStickyLabel,
} from "@/lib/bid/presenters/bid-blocker-sticky-action";
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

const CTA_CLASS =
  "shrink-0 rounded-sm bg-cta-bg px-4 py-2 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm";
const CTA_CLASS_LG =
  "shrink-0 rounded-sm bg-cta-bg px-5 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on shadow-sm";
const OUTLINE_CLASS =
  "shrink-0 border border-primary/40 px-4 py-2 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-primary";
const STATUS_CLASS =
  "shrink-0 px-2 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant";

type Props = {
  live: boolean;
  decision: BidPolicyDecision;
  loginNextPath: string;
  lotId?: string;
  userEmail?: string | null;
  kycFeedback?: import("@/lib/data/dto/dashboard-dtos").KycUserFeedbackDto | null;
  saleRegistrationPath?: string | null;
  step: 1 | 2;
  currentPriceLabel: string;
  priceFlash: boolean;
  onScrollToBid: () => void;
  remainingLabel: string;
  msRemaining: number;
  timerState: LotTimerState;
  countdownClock: string;
  lifecycleKind?: LotLifecycleKind;
  isOnBlock?: boolean;
  compact?: boolean;
  position?: LotBidPosition | null;
  reserveContext?: LotReserveContext;
  hasActiveAutoBid?: boolean;
  onFocusManualBid?: () => void;
  onFocusAutoBid?: () => void;
  isLeading?: boolean;
  upcomingSlot?: ReactNode;
};

function StickyBlockerAction({
  action,
  compact,
  loginNextPath,
  saleRegistrationPath,
  onScrollToBid,
}: {
  action: BidBlockerAction;
  compact: boolean;
  loginNextPath: string;
  saleRegistrationPath: string | null;
  onScrollToBid: () => void;
}): ReactNode {
  const label = bidBlockerStickyLabel(action);
  const ctaClass = compact ? CTA_CLASS : CTA_CLASS_LG;

  switch (action.kind) {
    case "link":
      return (
        <Link
          href={action.href}
          onClick={() => {
            if (action.href.includes("source=bid_gate")) {
              markContextualKycGateNavigation("bid_gate", loginNextPath);
            }
          }}
          className={
            action.href === "/admin"
              ? "shrink-0 border border-outline-variant/40 px-4 py-3 font-label text-[0.65rem] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant transition-colors hover:border-link/40 hover:text-link"
              : ctaClass
          }
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
    case "status":
      return <span className={STATUS_CLASS}>{label}</span>;
    case "panel":
      if (saleRegistrationPath && label === "Register") {
        return (
          <Link href={saleRegistrationPath} className={ctaClass}>
            {label}
          </Link>
        );
      }
      return (
        <Button type="button" onClick={onScrollToBid} className={`h-auto ${OUTLINE_CLASS}`}>
          {label}
        </Button>
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
  const blockerAction =
    decision.kind === "block" ? bidBlockerStickyAction(decision.presentation) : null;

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

  const blockerControl = blockerAction ? (
    <StickyBlockerAction
      action={blockerAction}
      compact={compact}
      loginNextPath={loginNextPath}
      saleRegistrationPath={saleRegistrationPath}
      onScrollToBid={onScrollToBid}
    />
  ) : null;

  if (compact) {
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
        {blockerControl}
        {!blockerAction && showBidCta && outbid ? (
          <Button
            type="button"
            onClick={hasActiveAutoBid && onFocusAutoBid ? onFocusAutoBid : onFocusManualBid}
            className={`h-auto ${CTA_CLASS}`}
          >
            {hasActiveAutoBid ? "Raise max" : "Increase bid"}
          </Button>
        ) : null}
        {!blockerAction && (autoBidLabel || positionLabel) ? (
          <span className="shrink-0 rounded-sm border border-primary/30 bg-primary/10 px-3 py-1.5 font-label text-[0.65rem] font-bold uppercase tracking-wider text-primary">
            {autoBidLabel ?? positionLabel}
          </span>
        ) : null}
      </MarketingStickyBidBar>
    );
  }

  let right: ReactNode = blockerControl;
  if (!blockerAction) {
    if (step === 1) {
      if (isLeading && onFocusAutoBid) {
        right = (
          <Button type="button" onClick={onFocusAutoBid} className={`h-auto ${CTA_CLASS_LG}`}>
            Raise auto-bid max
          </Button>
        );
      } else if (outbid && (onFocusAutoBid || onFocusManualBid)) {
        right = (
          <Button
            type="button"
            onClick={hasActiveAutoBid && onFocusAutoBid ? onFocusAutoBid : onFocusManualBid}
            className={`h-auto ${CTA_CLASS_LG}`}
          >
            {hasActiveAutoBid ? "Raise auto-bid max" : "Increase bid"}
          </Button>
        );
      } else {
        right = (
          <Button type="button" onClick={onScrollToBid} className={`h-auto ${CTA_CLASS_LG}`}>
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
