"use client";

import { ArtworkTrustStrip } from "@/components/sections/artwork/artwork-trust-strip";
import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import { BidDisplay } from "@/components/sections/artwork/bid-display";
import { BidForm } from "@/components/sections/artwork/bid-form";
import { BidHistory, type BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useAuctionRealtime } from "@/hooks/use-auction-realtime";
import { useAuctionPorts } from "@/lib/context/auction-ports";
import type { SessionUser } from "@/lib/data/contracts";
import { formatCountdownClock } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import type { Auction } from "@auction/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  auction: Auction;
  initialHistory: BidHistoryEntry[];
  /** Current winning bidder from SSR (null if unknown / sealed). */
  initialLeadingBidderId?: string | null;
  sessionUser: SessionUser | null;
};

const HISTORY_CAP = 20;

function nextMinBidAmount(auction: Auction, currentPriceStr: string): number {
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
  const { bidWriter } = useAuctionPorts();
  const [currentPrice, setCurrentPrice] = useState(auction.currentPrice);
  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
  const [amount, setAmount] = useState("");
  const [maxAuto, setMaxAuto] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bidSuccess, setBidSuccess] = useState(false);
  const [history, setHistory] = useState<BidHistoryEntry[]>(initialHistory);
  const [lotStatus, setLotStatus] = useState<Auction["status"]>(auction.status);
  const [leadingBidderId, setLeadingBidderId] = useState<string | null>(initialLeadingBidderId);
  const [outbidToast, setOutbidToast] = useState<string | null>(null);
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

  useAuctionRealtime(auction.id, {
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
        setOutbidToast("You've been outbid on this lot.");
        window.setTimeout(() => setOutbidToast(null), 6500);
      }
    },
    onAuctionExtended: (payload) => {
      const p = payload as { newEndTime?: string };
      if (p?.newEndTime) {
        setEndTime(new Date(p.newEndTime).getTime());
      }
    },
    onAuctionEnded: (p) => {
      setLotStatus("ended");
      setCurrentPrice(p.currentPrice);
      setLeadingBidderId(p.winnerId);
      setEndedBanner("This auction has ended.");
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
      setError(`Enter at least ${formatMoney(minNumeric.toFixed(2))}`);
      return;
    }
    const maxN = maxAuto.trim() === "" ? undefined : Number.parseFloat(maxAuto);
    if (maxN !== undefined) {
      if (Number.isNaN(maxN) || maxN < n) {
        setError("Max auto-bid must be greater than or equal to your bid.");
        return;
      }
    }
    setStep(2);
  }, [amount, maxAuto, minNumeric]);

  const onConfirm = useCallback(async () => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n)) {
      setError("Invalid amount");
      return;
    }
    const maxN = maxAuto.trim() === "" ? undefined : Number.parseFloat(maxAuto);
    setSubmitting(true);
    const result = await bidWriter.placeBid({
      auctionId: auction.id,
      amount: n,
      ...(maxN !== undefined && !Number.isNaN(maxN) ? { maxAutoBidAmount: maxN } : {}),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
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
    <div className="mb-20 min-w-0 rounded-xl bg-surface-container-lowest/90 p-8 shadow-lg ring-1 ring-outline-variant/10 lg:p-12">
      {outbidToast ? (
        <div
          className="mb-6 rounded-lg border border-error/40 bg-error/10 px-4 py-3 font-body text-sm text-error shadow-sm ring-1 ring-error/20"
          role="alert"
        >
          <p className="font-label text-xs font-bold uppercase tracking-widest text-error">
            Outbid
          </p>
          <p className="mt-1 text-on-surface">{outbidToast}</p>
        </div>
      ) : null}

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

        {!live ? (
          <p className="font-body text-secondary">This auction is not accepting bids.</p>
        ) : !sessionUser ? (
          <div className="rounded-lg bg-surface-container-high/80 p-8 text-center ring-1 ring-outline-variant/10">
            <p className="mb-4 font-body text-sm text-on-surface-variant">
              Sign in to place a bid on this lot.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(loginNext)}`}
              className="inline-flex w-full items-center justify-center bg-gradient-to-br from-primary to-primary-container py-4 font-label text-xs font-bold uppercase tracking-[0.3em] text-on-primary shadow-md transition-opacity hover:opacity-95"
            >
              Sign in to bid
            </Link>
          </div>
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

      {live ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/25 bg-surface-container-lowest/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.12)] backdrop-blur-md lg:hidden dark:border-outline-variant/20 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                Current bid
              </p>
              <p
                className={`truncate font-headline text-lg text-on-surface ${priceFlash ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]" : ""}`}
              >
                {formatMoney(currentPrice)}
              </p>
            </div>
            {!sessionUser ? (
              <Link
                href={`/login?next=${encodeURIComponent(loginNext)}`}
                className="shrink-0 bg-gradient-to-br from-primary to-primary-container px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-primary shadow-sm"
              >
                Sign in
              </Link>
            ) : step === 1 ? (
              <button
                type="button"
                onClick={scrollToBid}
                className="shrink-0 bg-gradient-to-br from-primary to-primary-container px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-on-primary shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Place bid
              </button>
            ) : (
              <button
                type="button"
                onClick={scrollToBid}
                className="shrink-0 border border-primary/40 px-5 py-3 font-label text-xs font-bold uppercase tracking-widest text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Confirm bid
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
