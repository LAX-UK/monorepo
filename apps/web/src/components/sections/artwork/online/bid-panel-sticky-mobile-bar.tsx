"use client";

import { BidStickyMobileBar } from "@/components/bid/bid-sticky-mobile-bar";
import { useBidPanelStickyVM } from "@/components/sections/artwork/online/bid-panel-context";

export function BidPanelStickyMobileBar() {
  const sticky = useBidPanelStickyVM();

  return (
    <BidStickyMobileBar
      live={sticky.live}
      decision={sticky.decision}
      loginNextPath={sticky.loginNextPath}
      lotId={sticky.lotId}
      userEmail={sticky.userEmail}
      kycFeedback={sticky.kycFeedback}
      {...(sticky.saleRegistrationPath
        ? { saleRegistrationPath: sticky.saleRegistrationPath }
        : {})}
      step={sticky.step}
      currentPriceLabel={sticky.currentPriceLabel}
      priceFlash={sticky.priceFlash}
      onScrollToBid={sticky.onScrollToBid}
      remainingLabel={sticky.remainingLabel}
      msRemaining={sticky.msRemaining}
      timerState={sticky.timerState}
      countdownClock={sticky.countdownClock}
      lifecycleKind={sticky.lifecycleKind}
      isOnBlock={sticky.isOnBlock}
      compact={sticky.compact}
      position={sticky.position}
      reserveContext={sticky.reserveContext}
      hasActiveAutoBid={sticky.hasActiveAutoBid}
      onFocusManualBid={sticky.onFocusManualBid}
      onFocusAutoBid={sticky.onFocusAutoBid}
      isLeading={sticky.isLeading}
      upcomingSlot={sticky.upcomingSlot}
    />
  );
}
