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
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import { useLotPorts } from "@/lib/context/lot-ports";
import { useOnlineLotLifecycle } from "@/lib/context/online-lot-lifecycle";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto } from "@/lib/data/http/kyc.server";
import { isEnglishOnlyAuctionsLocked } from "@/lib/feature-flags/english-only-auctions";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import { lotPath } from "@/lib/seo/url";
import { type BidErrorPresentation, clientBidError, mapBidError } from "@/lib/ui/bid-error";
import { notify } from "@/lib/ui/notify";
import type { Lot, Sale } from "@auction/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, cn } from "@auction/ui";
import { ArrowUpToLine, CircleAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Props = {
  auction: Lot;
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
  summarySeed: LotSummarySeedVM;
  initialUserMaxAuto: string | null;
  /** Watchlist state for scheduled / no-sale notify CTAs in `LotInfoStack`. */
  initialWatching?: boolean;
  loginNextPath?: string;
  /** When true, omit estimate/timer stack (e.g. online layout shows it in the queue sidebar). */
  omitPricingHeader?: boolean;
  kycSummary?: KycStatusSummaryDto | null;
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
  initialUserMaxAuto,
  initialWatching = false,
  loginNextPath,
  omitPricingHeader = false,
  kycSummary = null,
  saleForLifecycle = null,
}: Props) {
  const { bidWriter } = useLotPorts();
  const onlineLifecycle = useOnlineLotLifecycle();
  const [currentPrice, setCurrentPrice] = useState(auction.currentPrice);
  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
  const startTimeMs = useMemo(() => new Date(auction.startTime).getTime(), [auction.startTime]);
  const [amount, setAmount] = useState("");
  const [maxAuto, setMaxAuto] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<BidErrorPresentation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bidSuccess, setBidSuccess] = useState(false);
  const [history, setHistory] = useState<BidHistoryEntry[]>(initialHistory);
  const [lotStatus, setLotStatus] = useState<Lot["status"]>(auction.status);
  const [leadingBidderId, setLeadingBidderId] = useState<string | null>(initialLeadingBidderId);
  const [priceFlash, setPriceFlash] = useState(false);
  const [endedBanner, setEndedBanner] = useState<string | null>(null);
  const [lastKnownMaxAuto, setLastKnownMaxAuto] = useState<string | null>(initialUserMaxAuto);
  const [autoBidOpen, setAutoBidOpen] = useState(() =>
    Boolean(initialUserMaxAuto && initialUserMaxAuto.trim() !== ""),
  );
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
      if (sessionUser?.id && e.outbidUserId === sessionUser.id) {
        notify.warning("You've been outbid", {
          id: `outbid-${auction.id}`,
          description: "Place a higher bid to retake the lead.",
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
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

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

  const remainingLabel = formatCountdownForDisplay(endTime - now);

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
      classifyLotLifecycle(lifecycleLot, saleForLifecycle, now, {
        recentlyExtended: Boolean(
          onlineLifecycle?.extendedByMs && onlineLifecycle.extendedByMs > 0,
        ),
      }),
    [lifecycleLot, saleForLifecycle, now, onlineLifecycle?.extendedByMs],
  );

  const countdownClock = useMemo(() => {
    if (
      lifecycle.msLeft != null &&
      (lifecycle.kind === "scheduled" || lifecycle.kind === "live" || lifecycle.kind === "extended")
    ) {
      return formatCountdownForDisplay(lifecycle.msLeft);
    }
    return remainingLabel;
  }, [lifecycle, remainingLabel]);

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

  const onReview = useCallback(() => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n + 1e-9 < minNumeric) {
      setError(clientBidError(`Enter at least ${formatMoney(minNumeric.toFixed(2))}`));
      return;
    }
    const maxN = maxAuto.trim() === "" ? undefined : Number.parseFloat(maxAuto);
    if (maxN !== undefined) {
      if (Number.isNaN(maxN) || maxN < n) {
        setError(clientBidError("Max auto-bid must be greater than or equal to your bid."));
        return;
      }
    }
    setStep(2);
  }, [amount, maxAuto, minNumeric]);

  const onConfirm = useCallback(async () => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n)) {
      setError(clientBidError("Invalid amount"));
      return;
    }
    const maxN = maxAuto.trim() === "" ? undefined : Number.parseFloat(maxAuto);
    setSubmitting(true);
    const result = await bidWriter.placeBid({
      lotId: auction.id,
      amount: n,
      ...(maxN !== undefined && !Number.isNaN(maxN) ? { maxAutoBidAmount: maxN } : {}),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(mapBidError(result.error));
      setStep(1);
      return;
    }
    setCurrentPrice(result.bid.amount);
    const bidderId = result.bid.bidderId ?? result.bid.placedByUserId ?? "";
    setLeadingBidderId(bidderId || null);
    setLastKnownMaxAuto(result.bid.maxAutoBidAmount ?? null);
    triggerPriceFlash();
    pushHistory({
      id: result.bid.id,
      bidderId,
      amount: result.bid.amount,
    });
    setAmount("");
    setMaxAuto("");
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
  }, [amount, auction, bidWriter, maxAuto, pushHistory, triggerPriceFlash]);

  const onUseMinimum = useCallback(() => {
    setAmount(minNumeric.toFixed(2));
    setError(null);
  }, [minNumeric]);

  const loginNext = loginNextPath ?? lotPath(auction);

  const scrollToBid = useCallback(() => {
    document.getElementById("bid-interactive-anchor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const biddingLive = lotStatus === "active";
  const gateBlocked = (d: { kind: "allow" } | { kind: "block" }) => d.kind === "block";

  const englishOnlySurfaceLock =
    isEnglishOnlyAuctionsLocked() &&
    auction.auctionType !== "english" &&
    auction.auctionType !== "buy_it_now";

  return (
    <BidGate
      user={sessionUser}
      lot={auction}
      lotStatus={lotStatus}
      loginNextPath={loginNext}
      kycBidGate={kycSummary?.requiresKyc ? { requiresKyc: true } : null}
      biddingLifecycle={{ kind: lifecycle.kind }}
    >
      {({ decision }) => (
        <div className={cn("min-w-0", omitPricingHeader ? "w-full max-w-none" : "max-w-[480px]")}>
          <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
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
                  className="mb-3 inline-flex rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 font-label text-[10px] font-bold uppercase tracking-widest text-amber-900 dark:text-amber-200"
                  aria-live="polite"
                >
                  Extended +{Math.max(1, Math.round(onlineLifecycle.extendedByMs / 1000))}s
                </p>
              ) : null}
              <LotHighestBidderBanner status={bannerStatus} endedBanner={endedBanner} />
            </div>

            {englishOnlySurfaceLock ? (
              <p className="mt-6 rounded-md border border-outline-variant/40 bg-surface-container-low px-4 py-3 font-body text-sm text-on-surface-variant">
                Self-service bidding is only offered for English and buy-now lots while this
                catalogue mode is enabled. For this listing, please contact the saleroom team.
              </p>
            ) : null}

            {!englishOnlySurfaceLock &&
            (auction.auctionType === "english" || auction.auctionType === "buy_it_now") ? (
              <>
                <TooltipProvider delayDuration={200}>
                  <details
                    className="group mt-6 w-full rounded-[4px] bg-white p-3 outline outline-1 outline-offset-[-1px] outline-[rgba(209,209,209,0.65)] dark:bg-surface-container-low dark:outline-outline-variant/50"
                    open={autoBidOpen}
                    onToggle={(e) => setAutoBidOpen((e.target as HTMLDetailsElement).open)}
                  >
                    <summary className="flex h-10 cursor-pointer list-none items-center gap-2.5 [&::-webkit-details-marker]:hidden">
                      <ArrowUpToLine
                        className="size-5 shrink-0 text-[#050505] transition-transform duration-200 motion-reduce:transition-none group-open:rotate-180 dark:text-on-surface"
                        aria-hidden
                      />
                      <span className="flex-1 font-body text-sm font-semibold uppercase leading-6 text-[#050505] dark:text-on-surface">
                        Set auto bid
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="shrink-0 rounded-full p-0.5 text-[#050505] hover:bg-black/5 dark:text-on-surface dark:hover:bg-white/10"
                            aria-label="About max auto-bid"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <CircleAlert className="size-5" strokeWidth={1.5} aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                          Set a maximum amount; we place incremental bids for you up to that limit.
                        </TooltipContent>
                      </Tooltip>
                    </summary>
                    <div className="mt-2.5">
                      <LotAutoBidPanel
                        auctionType={auction.auctionType}
                        maxAuto={maxAuto}
                        onMaxAutoChange={setMaxAuto}
                        serverMaxAuto={lastKnownMaxAuto}
                        disabled={gateBlocked(decision)}
                      />
                    </div>
                  </details>
                </TooltipProvider>
                <p className="mt-4 text-center font-body text-[13px] font-medium uppercase leading-[13px] text-[#474747] dark:text-on-surface-variant">
                  OR enter bid manually
                </p>
              </>
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
                      step1ButtonLabel={useOnlineBidStepper ? "Place bid" : "Review bid"}
                    />
                  ) : (
                    <BidConfirmation
                      amount={amount}
                      maxAuto={maxAuto.trim() === "" ? null : maxAuto}
                      error={error}
                      submitting={submitting}
                      onCancel={() => setStep(1)}
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
              step={step}
              currentPriceLabel={formatMoney(currentPrice)}
              priceFlash={priceFlash}
              onScrollToBid={scrollToBid}
              remainingLabel={remainingLabel}
              msRemaining={endTime - now}
              timerState={timerState}
              countdownClock={countdownClock}
            />
          ) : null}
        </div>
      )}
    </BidGate>
  );
}
