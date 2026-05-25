"use client";

import { BidGate } from "@/components/bid/bid-gate";
import { BidStickyMobileBar } from "@/components/bid/bid-sticky-mobile-bar";
import { classifyLotTimerState } from "@/components/lot-timer";
import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
import { ArtworkWatchToggle } from "@/components/sections/artwork/artwork-watch-toggle";
import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import type { BidDisplayStatus } from "@/components/sections/artwork/bid-display-status-banner";
import { BidForm } from "@/components/sections/artwork/bid-form";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { LotAutoBidPanel } from "@/components/sections/artwork/redesign/lot-auto-bid-panel";
import { LotHighestBidderBanner } from "@/components/sections/artwork/redesign/lot-highest-bidder-banner";
import { LotInfoStack } from "@/components/sections/artwork/redesign/lot-info-stack";
import { LotMobilePricingStrip } from "@/components/sections/artwork/redesign/lot-mobile-pricing-strip";
import { LotOutbidBanner } from "@/components/sections/artwork/redesign/lot-outbid-banner";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { useNow } from "@/hooks/use-now";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import type { SaleRegistrationBidGateContext } from "@/lib/bid/policies/types";
import { useLotPorts } from "@/lib/context/lot-ports";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import type { AutoBidSettings, SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/dto/dashboard-dtos";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { lotPath } from "@/lib/seo/url";
import { type BidErrorPresentation, clientBidError, mapBidError } from "@/lib/ui/bid-error";
import { shouldStayOnBidConfirmStep } from "@/lib/ui/bid-error/confirm-step";
import { notify } from "@/lib/ui/notify";
import type { Lot, Sale } from "@auction/types";
import { cn } from "@auction/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  auction: Lot;
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
  summarySeed: LotSummarySeedVM;
  initialAutoBidSettings?: AutoBidSettings | null;
  /** Watchlist state for scheduled / no-sale notify CTAs in `LotInfoStack`. */
  initialWatching?: boolean;
  loginNextPath?: string;
  /** When true, omit estimate/timer stack (e.g. online layout shows it in the queue sidebar). */
  omitPricingHeader?: boolean;
  /** Show compact pricing strip on mobile when `omitPricingHeader` is true. */
  mobilePricingStrip?: boolean;
  kycSummary?: KycStatusSummaryDto | null;
  saleRegistrationBidGate?: SaleRegistrationBidGateContext | null;
  /** Sale page path for registration error CTAs. */
  saleRegistrationPath?: string | null;
  orgModuleEnabled?: boolean;
  /** Parent sale (when known) for pre-launch / draft-sale catalogue messaging. */
  saleForLifecycle?: Pick<Sale, "status" | "deliveryMode"> | null;
};

const HISTORY_CAP = 20;

const FIGMA_PRIMARY =
  "rounded border border-outline bg-on-surface px-8 py-4 text-base font-semibold leading-6 tracking-wide text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container-highest";

export function ArtworkBidPanel({
  auction,
  initialHistory,
  initialLeadingBidderId = null,
  sessionUser,
  summarySeed,
  initialAutoBidSettings = null,
  initialWatching = false,
  loginNextPath,
  omitPricingHeader = false,
  mobilePricingStrip = false,
  kycSummary = null,
  saleRegistrationBidGate = null,
  saleRegistrationPath = null,
  orgModuleEnabled = true,
  saleForLifecycle = null,
}: Props) {
  const { bidWriter } = useLotPorts();
  const onlineLifecycle = useOnlineLotLifecycle();
  const [currentPrice, setCurrentPrice] = useState(auction.currentPrice);
  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
  const startTimeMs = useMemo(() => new Date(auction.startTime).getTime(), [auction.startTime]);
  const [amount, setAmount] = useState("");
  const [maxAuto, setMaxAuto] = useState(initialAutoBidSettings?.maxAutoBidAmount ?? "");
  const [autoBidStep, setAutoBidStep] = useState(initialAutoBidSettings?.autoBidStepAmount ?? "");
  const [activeAutoBid, setActiveAutoBid] = useState<AutoBidSettings | null>(
    initialAutoBidSettings,
  );
  const [autoBidDraftDirty, setAutoBidDraftDirty] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<BidErrorPresentation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const now = useNow();
  const [bidSuccess, setBidSuccess] = useState(false);
  const [history, setHistory] = useState<BidHistoryEntry[]>(initialHistory);
  const [lotStatus, setLotStatus] = useState<Lot["status"]>(auction.status);
  const [leadingBidderId, setLeadingBidderId] = useState<string | null>(initialLeadingBidderId);
  const [priceFlash, setPriceFlash] = useState(false);
  const [endedBanner, setEndedBanner] = useState<string | null>(null);
  const [outbidBannerVisible, setOutbidBannerVisible] = useState(false);
  const confirmIdempotencyKeyRef = useRef<string | null>(null);
  const endTimeRef = useRef(endTime);
  endTimeRef.current = endTime;

  const triggerPriceFlash = useCallback(() => {
    setPriceFlash(true);
    window.setTimeout(() => setPriceFlash(false), 500);
  }, []);

  const minNumeric = useMemo(
    () => getMinNextBidAmount(auction, currentPrice),
    [auction, currentPrice],
  );

  const pushHistory = useCallback((entry: Omit<BidHistoryEntry, "at"> & { at?: number }) => {
    setHistory((h) =>
      [{ ...entry, at: entry.at ?? Date.now() }, ...h]
        .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
        .slice(0, HISTORY_CAP),
    );
  }, []);

  const handleAutoBidDraft = useCallback(
    (draft: { maxAuto: string; step: string; dirty: boolean }) => {
      setMaxAuto(draft.maxAuto);
      setAutoBidStep(draft.step);
      setAutoBidDraftDirty(draft.dirty);
    },
    [],
  );

  const handleAutoBidSaved = useCallback((settings: AutoBidSettings | null) => {
    setActiveAutoBid(settings);
    setAutoBidDraftDirty(false);
    if (settings) {
      setMaxAuto(settings.maxAutoBidAmount);
      setAutoBidStep(settings.autoBidStepAmount ?? "");
    } else {
      setMaxAuto("");
      setAutoBidStep("");
    }
  }, []);

  useLotRealtime(auction.id, {
    onBidUpdate: (e) => {
      setCurrentPrice(e.currentPrice);
      setLeadingBidderId(e.bidderId);
      triggerPriceFlash();
      onlineLifecycle?.setExtendedDeltaMs(null);
      pushHistory({
        id: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
      });
      if (e.endTime) {
        setEndTime(new Date(e.endTime).getTime());
      }
      if (
        sessionUser?.id &&
        e.isAutoBid &&
        e.placedByUserId === sessionUser.id &&
        e.bidderId === sessionUser.id
      ) {
        notify.info("Auto-bid placed", {
          id: `auto-bid-${e.bidId}`,
          description: `Your proxy bid placed ${formatMoney(e.amount)}.`,
          duration: 6500,
        });
      }
      if (sessionUser?.id && e.outbidUserId === sessionUser.id) {
        setOutbidBannerVisible(true);
        notify.warning("You've been outbid", {
          id: `outbid-${auction.id}`,
          description: "Place a higher bid or raise your auto-bid max.",
          duration: 6500,
        });
      }
    },
    onLotExtended: (payload) => {
      const p = payload as { newEndTime?: string };
      if (!p?.newEndTime) return;
      const newMs = new Date(p.newEndTime).getTime();
      const prev = endTimeRef.current;
      const delta = Math.max(0, newMs - prev);
      setEndTime(newMs);
      if (delta > 0) {
        onlineLifecycle?.setExtendedDeltaMs(delta);
        notify.info("Closing time extended", {
          id: `lot-extend-${auction.id}`,
          description: `Anti-snipe added ${Math.round(delta / 1000)}s to the clock.`,
          duration: 7000,
        });
      }
    },
    onLotEnded: (p) => {
      setLotStatus("ended");
      setCurrentPrice(p.currentPrice);
      setLeadingBidderId(p.winnerId ?? null);
      const noSale = Boolean(p.noSale) || !p.winnerId;
      if (noSale) {
        setEndedBanner("Reserve not met — this lot passed unsold.");
      } else if (sessionUser?.id && p.winnerId === sessionUser.id) {
        setEndedBanner("You won this lot — complete checkout from your dashboard.");
      } else {
        setEndedBanner("This lot has sold — thank you for participating.");
      }
    },
    onLotEvent: (payload) => {
      if (!sessionUser?.id || !payload || typeof payload !== "object") return;
      const o = payload as Record<string, unknown>;
      if (o.type !== "proxy_cancelled") return;
      if (o.bidderUserId !== sessionUser.id) return;
      handleAutoBidSaved(null);
      notify.warning("Auto-bid cancelled", {
        id: `proxy-cancelled-${auction.id}`,
        description: "Your auto-bid on this lot was cleared by the saleroom.",
        duration: 8000,
      });
    },
  });

  useEffect(() => {
    const el = document.getElementById("bid-interactive-anchor");
    if (!el || !onlineLifecycle || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        onlineLifecycle.setBidCardInView(entry?.isIntersecting ?? false);
      },
      { root: null, rootMargin: "0px 0px -80px 0px", threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onlineLifecycle]);

  useEffect(() => {
    if (!bidSuccess) return;
    const t = window.setTimeout(() => setBidSuccess(false), 4000);
    return () => window.clearTimeout(t);
  }, [bidSuccess]);

  const bidStepNumeric = useMemo(() => {
    const inc = Number.parseFloat(auction.minBidIncrement);
    return Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  }, [auction.minBidIncrement]);

  const useOnlineBidStepper =
    omitPricingHeader &&
    (auction.auctionType === "english" || auction.auctionType === "buy_it_now");

  useEffect(() => {
    if (!useOnlineBidStepper) return;
    if (amount.trim() !== "") return;
    setAmount(minNumeric.toFixed(2));
  }, [useOnlineBidStepper, minNumeric, amount]);

  const remainingLabel = now != null ? formatCountdownForDisplay(endTime - now) : "";

  /** Fixed locale so SSR and client match (undefined follows Node vs browser locale and hydrates badly). */
  const saleEndLocalLabel = useMemo(() => {
    const d = new Date(endTime);
    return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  }, [endTime]);

  const saleStartLocalLabel = useMemo(() => {
    const d = new Date(startTimeMs);
    return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  }, [startTimeMs]);

  const timerState = useMemo(
    () =>
      classifyLotTimerState(
        {
          status: lotStatus,
          startTime: new Date(startTimeMs).toISOString(),
          endTime: new Date(endTime).toISOString(),
        },
        now,
      ),
    [lotStatus, startTimeMs, endTime, now],
  );

  const lifecycleLot = useMemo(
    () => ({
      id: auction.id,
      status: lotStatus,
      startTime: new Date(startTimeMs),
      endTime: new Date(endTime),
      winnerId: lotStatus === "ended" ? leadingBidderId : auction.winnerId,
      reservePrice: auction.reservePrice,
      currentPrice,
    }),
    [
      auction.id,
      auction.winnerId,
      auction.reservePrice,
      lotStatus,
      startTimeMs,
      endTime,
      currentPrice,
      leadingBidderId,
    ],
  );

  const lifecycle = useMemo(
    () =>
      classifyLotLifecycle(lifecycleLot, saleForLifecycle, now ?? 0, {
        recentlyExtended: Boolean(
          onlineLifecycle?.extendedByMs && onlineLifecycle.extendedByMs > 0,
        ),
      }),
    [lifecycleLot, saleForLifecycle, now, onlineLifecycle?.extendedByMs],
  );

  const countdownClock = useMemo(() => {
    if (now == null) return "";
    if (
      lifecycle.msLeft != null &&
      (lifecycle.kind === "scheduled" || lifecycle.kind === "live" || lifecycle.kind === "extended")
    ) {
      return formatCountdownForDisplay(lifecycle.msLeft);
    }
    return remainingLabel;
  }, [lifecycle, remainingLabel, now]);

  const ownLot = Boolean(sessionUser?.id && sessionUser.id === auction.sellerId);

  const isWinning = Boolean(
    sessionUser?.id &&
      leadingBidderId &&
      sessionUser.id === leadingBidderId &&
      lotStatus === "active",
  );

  const bannerStatus: BidDisplayStatus = ownLot
    ? { kind: "owner" }
    : isWinning
      ? { kind: "winning" }
      : null;

  const loginNext = loginNextPath ?? lotPath(auction);

  const clearConfirmAttempt = useCallback(() => {
    confirmIdempotencyKeyRef.current = null;
  }, []);

  const ensureConfirmIdempotencyKey = useCallback((): string => {
    if (!confirmIdempotencyKeyRef.current) {
      confirmIdempotencyKeyRef.current = crypto.randomUUID();
    }
    return confirmIdempotencyKeyRef.current;
  }, []);

  const includeAutoBidOnManualBid = activeAutoBid?.isActive || autoBidDraftDirty;

  const onReview = useCallback(() => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n + 1e-9 < minNumeric) {
      setError(clientBidError(`Enter at least ${formatMoney(minNumeric.toFixed(2))}`));
      return;
    }
    const regLimit = saleRegistrationBidGate?.approvedBidLimit;
    if (regLimit != null && n > regLimit + 1e-9) {
      setError(
        clientBidError(
          `Your approved limit for this sale is ${formatMoney(regLimit.toFixed(2))}. Enter a lower amount.`,
        ),
      );
      return;
    }
    const maxN =
      includeAutoBidOnManualBid && maxAuto.trim() !== "" ? Number.parseFloat(maxAuto) : undefined;
    if (maxN !== undefined) {
      if (Number.isNaN(maxN) || maxN < n) {
        setError(clientBidError("Max auto-bid must be greater than or equal to your bid."));
        return;
      }
      if (regLimit != null && maxN > regLimit + 1e-9) {
        setError(
          clientBidError(
            `Your approved limit for this sale is ${formatMoney(regLimit.toFixed(2))}. Lower your max auto-bid.`,
          ),
        );
        return;
      }
    }
    ensureConfirmIdempotencyKey();
    setStep(2);
  }, [
    amount,
    ensureConfirmIdempotencyKey,
    includeAutoBidOnManualBid,
    maxAuto,
    minNumeric,
    saleRegistrationBidGate?.approvedBidLimit,
  ]);

  const onConfirm = useCallback(async () => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n)) {
      setError(clientBidError("Invalid amount"));
      return;
    }
    const maxN =
      includeAutoBidOnManualBid && maxAuto.trim() !== "" ? Number.parseFloat(maxAuto) : undefined;
    const stepN =
      includeAutoBidOnManualBid && autoBidStep.trim() !== ""
        ? Number.parseFloat(autoBidStep)
        : undefined;
    setSubmitting(true);
    let result: Awaited<ReturnType<typeof bidWriter.placeBid>>;
    try {
      result = await bidWriter.placeBid({
        lotId: auction.id,
        amount: n,
        idempotencyKey: ensureConfirmIdempotencyKey(),
        ...(maxN !== undefined && !Number.isNaN(maxN)
          ? {
              maxAutoBidAmount: maxN,
              ...(stepN !== undefined && !Number.isNaN(stepN) ? { autoBidStepAmount: stepN } : {}),
            }
          : {}),
      });
    } catch {
      setError(clientBidError("Could not reach the server. Check your connection and try again."));
      return;
    } finally {
      setSubmitting(false);
    }
    if (!result.ok) {
      const mapped = mapBidError(result.error, {
        verifyReturnPath: loginNext,
        code: result.code ?? null,
        ...(saleRegistrationPath ? { saleRegistrationPath } : {}),
        kycFeedback: result.kycFeedback ?? kycSummary?.feedback ?? null,
      });
      setError(mapped);
      if (!shouldStayOnBidConfirmStep(result.code ?? null, result.error)) {
        clearConfirmAttempt();
        setStep(1);
      }
      return;
    }
    clearConfirmAttempt();
    setOutbidBannerVisible(false);
    setCurrentPrice(result.bid.amount);
    const bidderId = result.bid.bidderId ?? result.bid.placedByUserId ?? "";
    setLeadingBidderId(bidderId || null);
    if (result.bid.maxAutoBidAmount) {
      setActiveAutoBid({
        maxAutoBidAmount: result.bid.maxAutoBidAmount,
        autoBidStepAmount: result.bid.autoBidStepAmount ?? null,
        isActive: true,
      });
      setMaxAuto(result.bid.maxAutoBidAmount);
      if (result.bid.autoBidStepAmount) setAutoBidStep(result.bid.autoBidStepAmount);
    } else {
      setActiveAutoBid(null);
      setMaxAuto("");
      setAutoBidStep("");
    }
    triggerPriceFlash();
    pushHistory({
      id: result.bid.id,
      bidderId,
      amount: result.bid.amount,
    });
    setAmount("");
    setStep(1);
    setBidSuccess(true);

    const buyNow =
      auction.auctionType === "buy_it_now" &&
      auction.buyNowPrice !== null &&
      auction.buyNowPrice !== ""
        ? Number(auction.buyNowPrice)
        : null;
    const hitBuyNow =
      buyNow !== null && Number.isFinite(buyNow) && Number(result.bid.amount) + 1e-9 >= buyNow;
    if (auction.auctionType === "dutch" || hitBuyNow) {
      setLotStatus("ended");
      setEndedBanner(
        auction.auctionType === "dutch"
          ? "Sale complete — this Dutch lot has closed."
          : "Buy now — this lot has sold at the buy-now price.",
      );
    }
  }, [
    amount,
    autoBidStep,
    auction,
    bidWriter,
    clearConfirmAttempt,
    ensureConfirmIdempotencyKey,
    includeAutoBidOnManualBid,
    kycSummary?.feedback,
    loginNext,
    maxAuto,
    pushHistory,
    saleRegistrationPath,
    triggerPriceFlash,
  ]);

  const onUseMinimum = useCallback(() => {
    setAmount(minNumeric.toFixed(2));
    setError(null);
  }, [minNumeric]);

  const scrollToBid = useCallback(() => {
    document.getElementById("bid-interactive-anchor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const scrollToAutoBid = useCallback(() => {
    document.getElementById("lot-auto-bid-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const autoBidStickyLabel =
    activeAutoBid?.isActive && activeAutoBid.maxAutoBidAmount
      ? `Auto ${formatMoney(activeAutoBid.maxAutoBidAmount)}`
      : null;

  const autoBidBannerProps =
    activeAutoBid?.isActive && activeAutoBid.maxAutoBidAmount
      ? { max: activeAutoBid.maxAutoBidAmount, step: activeAutoBid.autoBidStepAmount }
      : null;

  const biddingLive = lotStatus === "active";
  const gateBlocked = (d: { kind: "allow" } | { kind: "block" }) => d.kind === "block";

  const englishOnlySurfaceLock =
    isEnglishOnlyAuctionsLocked() &&
    auction.auctionType !== "english" &&
    auction.auctionType !== "buy_it_now";

  const supportsAutoBid = auction.auctionType === "english" || auction.auctionType === "buy_it_now";
  const autoBidEligible =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    (lifecycle.kind === "live" || lifecycle.kind === "extended");
  const showAutoBidExplainer =
    !englishOnlySurfaceLock &&
    supportsAutoBid &&
    !autoBidEligible &&
    (lifecycle.kind === "scheduled" || lifecycle.kind === "preLaunch");

  useEffect(() => {
    if (isWinning) setOutbidBannerVisible(false);
  }, [isWinning]);

  const bidCardInView = onlineLifecycle?.bidCardInView ?? true;

  return (
    <BidGate
      user={sessionUser}
      lot={auction}
      lotStatus={lotStatus}
      loginNextPath={loginNext}
      kycBidGate={
        kycSummary?.requiresKyc
          ? { requiresKyc: true, feedback: kycSummary.feedback ?? null }
          : null
      }
      saleRegistrationBidGate={saleRegistrationBidGate}
      biddingLifecycle={{ kind: lifecycle.kind }}
      orgModuleEnabled={orgModuleEnabled}
    >
      {({ decision }) => (
        <div className={cn("min-w-0", omitPricingHeader ? "w-full max-w-none" : "max-w-[480px]")}>
          <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
            {omitPricingHeader && mobilePricingStrip ? (
              <LotMobilePricingStrip
                seed={summarySeed}
                currentPrice={currentPrice}
                minNextBid={minNumeric.toFixed(2)}
                lotNumber={auction.lotNumber}
              />
            ) : null}
            {omitPricingHeader ? null : (
              <LotInfoStack
                estimateLine={summarySeed.estimateLine}
                currentPrice={currentPrice}
                bidCount={history.length}
                reservePrice={auction.reservePrice}
                lifecycle={lifecycle}
                countdownClock={countdownClock}
                saleEndLocalLabel={saleEndLocalLabel}
                saleStartLocalLabel={saleStartLocalLabel}
                endAtIso={new Date(endTime).toISOString()}
                startAtIso={new Date(startTimeMs).toISOString()}
                currentUserId={sessionUser?.id ?? null}
                scheduledNotifySlot={
                  lifecycle.kind === "scheduled" ? (
                    <ArtworkWatchToggle
                      lotId={auction.id}
                      initialWatching={initialWatching}
                      isAuthenticated={Boolean(sessionUser)}
                      loginNextPath={loginNext}
                      marketingCta="notifyWhenOpens"
                    />
                  ) : null
                }
                endedNoSaleNotifySlot={
                  lifecycle.kind === "endedNoSale" ? (
                    <ArtworkWatchToggle
                      lotId={auction.id}
                      initialWatching={initialWatching}
                      isAuthenticated={Boolean(sessionUser)}
                      loginNextPath={loginNext}
                      marketingCta="notifyIfRelisted"
                    />
                  ) : null
                }
              />
            )}

            <div className="mt-6">
              {onlineLifecycle?.extendedByMs != null && onlineLifecycle.extendedByMs > 0 ? (
                <p
                  className="mb-3 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-amber-900 dark:text-amber-200"
                  aria-live="polite"
                >
                  Extended +{Math.max(1, Math.round(onlineLifecycle.extendedByMs / 1000))}s
                </p>
              ) : null}
              <LotHighestBidderBanner
                status={bannerStatus}
                endedBanner={endedBanner}
                autoBidActive={isWinning ? autoBidBannerProps : null}
              />
              {outbidBannerVisible && !isWinning && !ownLot && biddingLive ? (
                <LotOutbidBanner
                  onDismiss={() => setOutbidBannerVisible(false)}
                  onRebid={scrollToBid}
                  onUpdateAutoBid={scrollToAutoBid}
                />
              ) : null}
            </div>

            {englishOnlySurfaceLock ? (
              <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
                Self-service bidding is only offered for English and buy-now lots while this
                catalogue mode is enabled. For this listing, please contact the saleroom team.
              </p>
            ) : null}

            {autoBidEligible ? (
              <>
                <div id="lot-auto-bid-panel" className="mt-6 scroll-mt-28">
                  <LotAutoBidPanel
                    lot={auction}
                    auctionType={auction.auctionType}
                    currentPrice={currentPrice}
                    minNextBid={minNumeric}
                    isWinning={isWinning}
                    disabled={gateBlocked(decision)}
                    loginNextPath={loginNext}
                    initialSettings={activeAutoBid}
                    approvedBidLimit={saleRegistrationBidGate?.approvedBidLimit ?? null}
                    onDraftChange={handleAutoBidDraft}
                    onSettingsSaved={handleAutoBidSaved}
                  />
                </div>
                <p className="mt-4 text-center font-body text-[13px] font-medium uppercase leading-[13px] text-[#474747] dark:text-on-surface-variant">
                  OR enter bid manually
                </p>
              </>
            ) : showAutoBidExplainer ? (
              <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
                Auto-bid opens when this lot goes live
                {countdownClock ? ` in ${countdownClock}` : ""}.
              </p>
            ) : null}

            {!englishOnlySurfaceLock ? (
              <>
                <div
                  id="bid-interactive-anchor"
                  tabIndex={-1}
                  className={cn(
                    "scroll-mt-28 outline-none focus:outline-none",
                    auction.auctionType === "english" || auction.auctionType === "buy_it_now"
                      ? "mt-4"
                      : "mt-6",
                  )}
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
                      error={error}
                      showMaxAutoField={false}
                      reviewButtonClassName={FIGMA_PRIMARY}
                      amountFieldVariant={useOnlineBidStepper ? "stepper" : "input"}
                      stepNumeric={bidStepNumeric}
                      step1ButtonLabel="Review bid"
                    />
                  ) : (
                    <BidConfirmation
                      amount={amount}
                      maxAuto={includeAutoBidOnManualBid && maxAuto.trim() !== "" ? maxAuto : null}
                      autoBidStep={
                        includeAutoBidOnManualBid && autoBidStep.trim() !== "" ? autoBidStep : null
                      }
                      error={error}
                      submitting={submitting}
                      onCancel={() => {
                        clearConfirmAttempt();
                        setStep(1);
                      }}
                      onConfirm={onConfirm}
                    />
                  )}
                </div>

                <p className="mt-6 text-xs leading-relaxed text-on-surface-variant">
                  Minimum next bid{" "}
                  <span className="font-medium text-on-surface">
                    {formatMoney(minNumeric.toFixed(2))}
                  </span>
                  {biddingLive ? (
                    <>
                      {" "}
                      · {saleEndLocalLabel}. Timer uses your device&apos;s local time. Hammer price
                      plus buyer&apos;s premium; see{" "}
                      <a href="/shipping" className="text-primary underline">
                        shipping
                      </a>
                      .
                    </>
                  ) : null}
                </p>
              </>
            ) : null}
          </div>

          {!englishOnlySurfaceLock ? (
            <BidStickyMobileBar
              live={biddingLive}
              decision={decision}
              loginNextPath={loginNext}
              kycFeedback={kycSummary?.feedback ?? null}
              {...(saleRegistrationPath ? { saleRegistrationPath } : {})}
              step={step}
              currentPriceLabel={formatMoney(currentPrice)}
              priceFlash={priceFlash}
              onScrollToBid={scrollToBid}
              remainingLabel={remainingLabel}
              msRemaining={now != null ? endTime - now : 0}
              timerState={timerState}
              countdownClock={countdownClock}
              compact={bidCardInView}
              autoBidLabel={autoBidStickyLabel}
              outbid={outbidBannerVisible && !isWinning}
              onUpdateAutoBid={scrollToAutoBid}
            />
          ) : null}
        </div>
      )}
    </BidGate>
  );
}
