"use client";

import { BidGate } from "@/components/bid/bid-gate";
import { BidStickyMobileBar } from "@/components/bid/bid-sticky-mobile-bar";
import { ArtworkTrustStrip } from "@/components/sections/artwork/artwork-trust-strip";
import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import { BidDisplay } from "@/components/sections/artwork/bid-display";
import { BidForm } from "@/components/sections/artwork/bid-form";
import { BidHistory, type BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { useLotPorts } from "@/lib/context/lot-ports";
import type { SessionUser } from "@/lib/data/contracts";
import { formatCountdownClock } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import { type BidErrorPresentation, clientBidError, mapBidError } from "@/lib/ui/bid-error";
import type { Lot } from "@auction/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  auction: Lot;
  initialHistory: BidHistoryEntry[];
  /** Current winning bidder from SSR (null if unknown / sealed). */
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
};

const HISTORY_CAP = 20;

function nextMinBidAmount(auction: Lot, currentPriceStr: string): number {
  const cur = Number.parseFloat(currentPriceStr);
  if (auction.auctionType === "dutch") return cur;
  const start = Number.parseFloat(auction.startingPrice);
  const inc = Number.parseFloat(auction.minBidIncrement);
  const step = Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  const next = cur + step;
  if (auction.auctionType === "sealed") {
    return Number.isFinite(start) ? Math.max(next, start) : next;
  }
  return next;
}

export function ArtworkBidPanel({
  auction,
  initialHistory,
  initialLeadingBidderId = null,
  sessionUser,
}: Props) {
  const { bidWriter } = useLotPorts();
  const [currentPrice, setCurrentPrice] = useState(auction.currentPrice);
  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
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

  const triggerPriceFlash = useCallback(() => {
    setPriceFlash(true);
    window.setTimeout(() => setPriceFlash(false), 500);
  }, []);

  const minNumeric = useMemo(
    () => nextMinBidAmount(auction, currentPrice),
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

  const remainingLabel = formatCountdownClock(endTime - now);
  const msRemaining = endTime - now;

  const saleEndLocalLabel = useMemo(() => {
    const d = new Date(endTime);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }, [endTime]);

  const ownLot = Boolean(sessionUser?.id && sessionUser.id === auction.sellerId);

  const isWinning = Boolean(
    sessionUser?.id &&
      leadingBidderId &&
      sessionUser.id === leadingBidderId &&
      lotStatus === "active",
  );

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

  const loginNext = `/artwork/${auction.id}`;

  const scrollToBid = useCallback(() => {
    document.getElementById("bid-interactive-anchor")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const live = lotStatus === "active";

  return (
    <BidGate user={sessionUser} lot={auction} lotStatus={lotStatus} loginNextPath={loginNext}>
      {({ decision }) => (
        <div className="mb-20 min-w-0 rounded-xl bg-surface-container-lowest/90 p-8 shadow-lg ring-1 ring-outline-variant/10 lg:p-12">
          {endedBanner ? (
            <output
              className="mb-6 block rounded-lg border border-primary/30 bg-primary-container/15 px-4 py-3 font-body text-sm text-on-surface ring-1 ring-primary/20"
              aria-live="polite"
            >
              {endedBanner}
            </output>
          ) : null}

          <BidDisplay
            currentPrice={currentPrice}
            remainingLabel={remainingLabel}
            msRemaining={msRemaining}
            minNextBid={minNumeric.toFixed(2)}
            saleEndLocalLabel={saleEndLocalLabel}
            live={live}
            ownLot={ownLot}
            isWinning={isWinning}
            priceFlash={priceFlash}
          />

          <div
            id="bid-interactive-anchor"
            tabIndex={-1}
            className="scroll-mt-28 outline-none focus:outline-none"
          >
            {bidSuccess ? (
              <output className="mb-8 block rounded-md bg-primary-container/25 px-4 py-3 font-body text-sm text-on-primary-container ring-1 ring-primary/30">
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

          <BidHistory entries={history} />
          <ArtworkTrustStrip />

          <BidStickyMobileBar
            live={live}
            decision={decision}
            loginNextPath={loginNext}
            step={step}
            currentPriceLabel={formatMoney(currentPrice)}
            priceFlash={priceFlash}
            onScrollToBid={scrollToBid}
          />
        </div>
      )}
    </BidGate>
  );
}
