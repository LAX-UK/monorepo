"use client";

import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import { BidDisplay } from "@/components/sections/artwork/bid-display";
import { BidForm } from "@/components/sections/artwork/bid-form";
import { type BidHistoryEntry, BidHistory } from "@/components/sections/artwork/bid-history";
import { ArtworkTrustStrip } from "@/components/sections/artwork/artwork-trust-strip";
import { useAuctionRealtime } from "@/hooks/use-auction-realtime";
import { useAuctionPorts } from "@/lib/context/auction-ports";
import { formatCountdownClock } from "@/lib/format-countdown";
import { formatMoney } from "@/lib/format-currency";
import type { SessionUser } from "@/lib/data/contracts";
import type { Auction } from "@auction/types";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  auction: Auction;
  initialHistory: BidHistoryEntry[];
  sessionUser: SessionUser | null;
};

const HISTORY_CAP = 20;

export function ArtworkBidPanel({ auction, initialHistory, sessionUser }: Props) {
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

  const minNumeric = useMemo(() => Number.parseFloat(currentPrice) + 0.01, [currentPrice]);

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
      pushHistory({
        id: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
      });
      if (e.endTime) {
        setEndTime(new Date(e.endTime).getTime());
      }
    },
    onAuctionExtended: (payload) => {
      const p = payload as { newEndTime?: string };
      if (p?.newEndTime) {
        setEndTime(new Date(p.newEndTime).getTime());
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

  const remainingLabel = formatCountdownClock(endTime - now);

  const onReview = useCallback(() => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n < minNumeric) {
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
    pushHistory({
      id: result.bid.id,
      bidderId: result.bid.bidderId,
      amount: result.bid.amount,
    });
    setAmount("");
    setMaxAuto("");
    setStep(1);
    setBidSuccess(true);
  }, [amount, auction.id, bidWriter, maxAuto, pushHistory]);

  const onUseMinimum = useCallback(() => {
    setAmount(minNumeric.toFixed(2));
    setError(null);
  }, [minNumeric]);

  const loginNext = `/artwork/${auction.id}`;

  return (
    <div className="mb-20 rounded-xl bg-surface-container-lowest/90 p-8 shadow-lg ring-1 ring-outline-variant/10 lg:p-12">
      <BidDisplay
        currentPrice={currentPrice}
        remainingLabel={remainingLabel}
        live={auction.status === "active"}
      />

      {bidSuccess ? (
        <output className="mb-8 block rounded-md bg-primary-container/25 px-4 py-3 font-body text-sm text-on-primary-container ring-1 ring-primary/30">
          Bid placed successfully.
        </output>
      ) : null}

      {auction.status !== "active" ? (
        <p className="font-body text-secondary">This auction is not accepting bids.</p>
      ) : !sessionUser ? (
        <div className="rounded-lg bg-surface-container-high/80 p-8 text-center ring-1 ring-outline-variant/10">
          <p className="mb-4 font-body text-sm text-on-surface-variant">
            Sign in to place a bid on this lot.
          </p>
          <Link
            href={`/login?next=${encodeURIComponent(loginNext)}`}
            className="inline-flex w-full items-center justify-center bg-gradient-to-br from-primary to-primary-container py-4 font-label text-[10px] font-bold uppercase tracking-[0.3em] text-on-primary shadow-md transition-opacity hover:opacity-95"
          >
            Sign in to bid
          </Link>
        </div>
      ) : step === 1 ? (
        <BidForm
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

      <BidHistory entries={history} />
      <ArtworkTrustStrip />
    </div>
  );
}
