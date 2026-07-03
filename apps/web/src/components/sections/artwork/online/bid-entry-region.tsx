"use client";

import { LotBidFeedbackBanner } from "@/components/bid/lot-bid-feedback-banner";
import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import { BidForm } from "@/components/sections/artwork/bid-form";
import {
  FIGMA_PRIMARY,
  useBidPanelContext,
} from "@/components/sections/artwork/online/bid-panel-context";
import { LotAutoBidPanel } from "@/components/sections/artwork/redesign/lot-auto-bid-panel";
import { LotBidModeChooser } from "@/components/sections/artwork/redesign/lot-bid-mode-chooser";
import { formatMoney } from "@/lib/format-currency";
import { cn } from "@auction/ui";

export function BidEntryRegion() {
  const {
    surface,
    decision,
    bidControlsDisabled,
    sellerBlocked,
    auction,
    currentPrice,
    activeAutoBid,
    saleRegistrationBidGate,
    lifecycle,
    biddingLive,
    saleEndLocalLabel,
    refreshFromServer,
    biddingAllowed,
    realtimeHealthy,
    kycSummary,
    panel,
  } = useBidPanelContext();

  const {
    displayedFeedback,
    handleFeedbackAction,
    englishOnlySurfaceLock,
    autoBidEligible,
    supportsAutoBid,
    entryMode,
    switchEntryMode,
    showAutoBidExplainer,
    autoBidExplainerText,
    bidSuccess,
    step,
    minNumeric,
    amount,
    maxAuto,
    setAmount,
    setMaxAuto,
    onReview,
    onUseMinimum,
    manualBidBlockedReason,
    useOnlineBidStepper,
    bidStepNumeric,
    activeAutoBidNote,
    connectionBlocked,
    includeAutoBidOnManualBid,
    submitting,
    clearConfirmAttempt,
    setStep,
    onConfirm,
    loginNext,
    isWinning,
    handleAutoBidDraft,
    onAutoBidSaved,
    setFeedbackError,
  } = panel;

  return (
    <div
      id={surface === "full" ? "lot-bid-entry" : undefined}
      tabIndex={surface === "full" ? -1 : undefined}
      className={surface === "full" ? "scroll-mt-28 outline-none focus:outline-none" : undefined}
    >
      <LotBidFeedbackBanner
        error={displayedFeedback}
        className="mt-6"
        onAction={handleFeedbackAction}
      />

      {!englishOnlySurfaceLock && !sellerBlocked && autoBidEligible && supportsAutoBid ? (
        <div className="mt-6">
          <LotBidModeChooser
            mode={entryMode}
            onModeChange={(mode) => switchEntryMode(mode, { userInitiated: true })}
            disabled={bidControlsDisabled(decision)}
          />
        </div>
      ) : null}

      {!englishOnlySurfaceLock && !sellerBlocked && autoBidEligible ? (
        <div
          id={surface === "full" ? "lot-auto-bid-panel" : undefined}
          className={cn("mt-4 scroll-mt-28", entryMode !== "auto" && "hidden")}
          aria-hidden={entryMode !== "auto"}
        >
          <LotAutoBidPanel
            lot={auction}
            auctionType={auction.auctionType}
            currentPrice={currentPrice}
            minNextBid={minNumeric}
            isWinning={isWinning}
            disabled={bidControlsDisabled(decision)}
            loginNextPath={loginNext}
            initialSettings={activeAutoBid}
            approvedBidLimit={saleRegistrationBidGate?.approvedBidLimit ?? null}
            onDraftChange={handleAutoBidDraft}
            onSettingsSaved={onAutoBidSaved}
            onFeedbackError={setFeedbackError}
            kycFeedback={kycSummary?.feedback ?? null}
            biddingLive={biddingLive}
            biddingAllowed={biddingAllowed}
            realtimeHealthy={realtimeHealthy}
            refreshBeforeSave={async () => (await refreshFromServer()).ok}
          />
        </div>
      ) : !englishOnlySurfaceLock && showAutoBidExplainer ? (
        <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
          {autoBidExplainerText}
        </p>
      ) : null}

      {!englishOnlySurfaceLock &&
      (sellerBlocked
        ? decision.kind === "block"
        : autoBidEligible
          ? entryMode === "manual"
          : true) ? (
        <>
          <div
            id={surface === "full" ? "bid-interactive-anchor" : undefined}
            className={cn(autoBidEligible && !sellerBlocked ? "mt-4" : "mt-6")}
          >
            {bidSuccess ? (
              <output className="mb-4 block rounded-md bg-primary-container/25 px-4 py-3 font-body text-sm text-on-primary-container ring-1 ring-primary/30">
                Bid placed successfully.
              </output>
            ) : null}

            {decision.kind === "block" ? (
              decision.render()
            ) : step === 1 ? (
              <BidForm
                auctionType={auction.auctionType}
                minNumeric={minNumeric}
                amount={amount}
                maxAuto={maxAuto}
                onAmountChange={setAmount}
                onMaxAutoChange={setMaxAuto}
                onReview={onReview}
                onUseMinimum={onUseMinimum}
                error={null}
                manualBidBlockedReason={manualBidBlockedReason}
                showMaxAutoField={false}
                reviewButtonClassName={FIGMA_PRIMARY}
                amountFieldVariant={useOnlineBidStepper ? "stepper" : "input"}
                stepNumeric={bidStepNumeric}
                step1ButtonLabel="Review bid"
                activeAutoBidNote={activeAutoBidNote}
                biddingDisabled={connectionBlocked || Boolean(manualBidBlockedReason)}
              />
            ) : (
              <BidConfirmation
                amount={amount}
                maxAuto={
                  includeAutoBidOnManualBid && activeAutoBid?.maxAutoBidAmount
                    ? activeAutoBid.maxAutoBidAmount
                    : null
                }
                autoBidStep={
                  includeAutoBidOnManualBid && activeAutoBid?.autoBidStepAmount
                    ? activeAutoBid.autoBidStepAmount
                    : null
                }
                error={null}
                submitting={submitting}
                biddingDisabled={connectionBlocked}
                onCancel={() => {
                  clearConfirmAttempt();
                  setStep(1);
                }}
                onConfirm={onConfirm}
              />
            )}
          </div>

          {!sellerBlocked ? (
            <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">
              Minimum next bid{" "}
              <span className="font-medium text-on-surface">
                {formatMoney(minNumeric.toFixed(2))}
              </span>
              {biddingLive &&
              lifecycle.kind !== "liveSaleroom" &&
              lifecycle.kind !== "saleroomPaused" ? (
                <>
                  {" "}
                  · {saleEndLocalLabel}. Timer uses your device&apos;s local time. Hammer price plus
                  buyer&apos;s premium; see{" "}
                  <a href="/shipping" className="text-link underline">
                    shipping
                  </a>
                  .
                </>
              ) : null}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
