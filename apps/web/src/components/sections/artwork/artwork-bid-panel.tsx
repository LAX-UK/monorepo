"use client";

import { BidGate } from "@/components/bid/bid-gate";
import { BidStickyMobileBar } from "@/components/bid/bid-sticky-mobile-bar";
import { classifyLotTimerState } from "@/components/lot-timer";
import { ArtworkTrustStrip } from "@/components/sections/artwork/artwork-trust-strip";
import type { LotSummarySeedVM } from "@/components/sections/artwork/artwork-view-models";
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
import type { SessionUser } from "@/lib/data/contracts";
import { formatCountdownForDisplay } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { lotPath } from "@/lib/seo/url";
import { type BidErrorPresentation, clientBidError, mapBidError } from "@/lib/ui/bid-error";
import type { Lot } from "@auction/types";
import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  auction: Lot;
  initialHistory: BidHistoryEntry[];
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
  summarySeed: LotSummarySeedVM;
  initialUserMaxAuto: string | null;
  loginNextPath?: string;
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
  loginNextPath,
}: Props) {
  const { bidWriter } = useLotPorts();
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
      pushHistory({
        id: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
      });
      if (e.endTime) {
        setEndTime(new Date(e.endTime).getTime());
      }
      if (sessionUser?.id && e.outbidUserId === sessionUser.id) {
        toast.error("You've been outbid on this lot.", {
          id: `outbid-${auction.id}`,
          description: "Place a higher bid to stay in the running.",
          duration: 6500,
        });
      }
    },
    onLotExtended: (payload) => {
      const p = payload as { newEndTime?: string };
      if (p?.newEndTime) {
        setEndTime(new Date(p.newEndTime).getTime());
      }
    },
    onLotEnded: (p) => {
      setLotStatus("ended");
      setCurrentPrice(p.currentPrice);
      setLeadingBidderId(p.winnerId);
      setEndedBanner("This lot has ended.");
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

  const remainingLabel = formatCountdownForDisplay(endTime - now);

  const saleEndLocalLabel = useMemo(() => {
    const d = new Date(endTime);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }, [endTime]);

  const saleStartLocalLabel = useMemo(() => {
    const d = new Date(startTimeMs);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
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

  const countdownClock = useMemo(() => {
    if (timerState.kind === "live" || timerState.kind === "opensSoon") {
      return formatCountdownForDisplay(timerState.msLeft);
    }
    return remainingLabel;
  }, [timerState, remainingLabel]);

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
    setLeadingBidderId(result.bid.bidderId);
    setLastKnownMaxAuto(result.bid.maxAutoBidAmount ?? null);
    triggerPriceFlash();
    pushHistory({
      id: result.bid.id,
      bidderId: result.bid.bidderId,
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

  const live = lotStatus === "active";
  const gateBlocked = (d: { kind: "allow" } | { kind: "block" }) => d.kind === "block";

  return (
    <BidGate user={sessionUser} lot={auction} lotStatus={lotStatus} loginNextPath={loginNext}>
      {({ decision }) => (
        <div className="min-w-0 max-w-[480px]">
          <div className="rounded-lg border border-outline-variant/25 bg-surface-container-lowest p-5 shadow-[0_1px_0_rgba(0,0,0,0.04)] dark:bg-surface-container-low/40">
            <LotInfoStack
              estimateLine={summarySeed.estimateLine}
              currentPrice={currentPrice}
              bidCount={history.length}
              reservePrice={auction.reservePrice}
              timerState={timerState}
              countdownClock={countdownClock}
              saleEndLocalLabel={saleEndLocalLabel}
              saleStartLocalLabel={saleStartLocalLabel}
              endAtIso={new Date(endTime).toISOString()}
              startAtIso={new Date(startTimeMs).toISOString()}
            />

            <div className="mt-4">
              <ArtworkTrustStrip compact />
            </div>

            <div className="mt-6">
              <LotHighestBidderBanner status={bannerStatus} endedBanner={endedBanner} />
            </div>

            {auction.auctionType === "english" || auction.auctionType === "buy_it_now" ? (
              <details
                className="group mt-6"
                open={autoBidOpen}
                onToggle={(e) => setAutoBidOpen((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer list-none font-label text-xs font-bold uppercase tracking-widest text-primary hover:underline [&::-webkit-details-marker]:hidden">
                  <span className="inline-flex items-center gap-1">
                    Set a max auto-bid
                    <ChevronDown className="size-3 transition-transform duration-200 group-open:rotate-180" />
                  </span>
                </summary>
                <div className="mt-3">
                  <LotAutoBidPanel
                    auctionType={auction.auctionType}
                    maxAuto={maxAuto}
                    onMaxAutoChange={setMaxAuto}
                    serverMaxAuto={lastKnownMaxAuto}
                    disabled={gateBlocked(decision)}
                  />
                </div>
              </details>
            ) : null}

            <div
              id="bid-interactive-anchor"
              tabIndex={-1}
              className="mt-6 scroll-mt-28 outline-none focus:outline-none"
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
              {live ? (
                <>
                  {" "}
                  · {saleEndLocalLabel}. Timer uses your device&apos;s local time. Hammer price plus
                  buyer&apos;s premium; see{" "}
                  <a href="/shipping" className="text-primary underline">
                    shipping
                  </a>
                  .
                </>
              ) : null}
            </p>
          </div>

          <BidStickyMobileBar
            live={live}
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
        </div>
      )}
    </BidGate>
  );
}
