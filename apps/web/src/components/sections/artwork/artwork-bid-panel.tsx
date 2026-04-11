"use client";

import { BidConfirmation } from "@/components/sections/artwork/bid-confirmation";
import { BidDisplay } from "@/components/sections/artwork/bid-display";
import { BidForm } from "@/components/sections/artwork/bid-form";
import { type BidHistoryEntry, BidHistory } from "@/components/sections/artwork/bid-history";
import { useAuctionRealtime } from "@/hooks/use-auction-realtime";
import { useAuctionPorts } from "@/lib/context/auction-ports";
import { formatMoney } from "@/lib/format-currency";
import type { Auction } from "@auction/types";
import { useCallback, useEffect, useMemo, useState } from "react";

type Props = {
  auction: Auction;
};

function formatRemaining(ms: number): string {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

const HISTORY_CAP = 20;

export function ArtworkBidPanel({ auction }: Props) {
  const { bidWriter } = useAuctionPorts();
  const [currentPrice, setCurrentPrice] = useState(auction.currentPrice);
  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [bidSuccess, setBidSuccess] = useState(false);
  const [history, setHistory] = useState<BidHistoryEntry[]>([]);

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

  const onReview = useCallback(() => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n) || n < minNumeric) {
      setError(`Enter at least ${formatMoney(minNumeric.toFixed(2))}`);
      return;
    }
    setStep(2);
  }, [amount, minNumeric]);

  const onConfirm = useCallback(async () => {
    setError(null);
    const n = Number.parseFloat(amount);
    if (Number.isNaN(n)) {
      setError("Invalid amount");
      return;
    }
    setSubmitting(true);
    const result = await bidWriter.placeBid({ auctionId: auction.id, amount: n });
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
    setStep(1);
    setBidSuccess(true);
  }, [amount, auction.id, bidWriter, pushHistory]);

  const onUseMinimum = useCallback(() => {
    setAmount(minNumeric.toFixed(2));
    setError(null);
  }, [minNumeric]);

  const remainingLabel = formatRemaining(endTime - now);

  return (
    <div className="mb-20 border border-outline-variant/30 bg-surface-container-lowest p-8 shadow-sm lg:p-12">
      <BidDisplay currentPrice={currentPrice} remainingLabel={remainingLabel} />

      {bidSuccess ? (
        <div
          className="mb-8 rounded-md border border-primary/40 bg-primary-container/25 px-4 py-3 font-body text-sm text-on-primary-container"
          role="status"
        >
          Bid placed successfully.
        </div>
      ) : null}

      {auction.status !== "active" ? (
        <p className="font-body text-secondary">This auction is not accepting bids.</p>
      ) : step === 1 ? (
        <BidForm
          minNumeric={minNumeric}
          amount={amount}
          onAmountChange={setAmount}
          onReview={onReview}
          onUseMinimum={onUseMinimum}
          error={error}
        />
      ) : (
        <BidConfirmation
          amount={amount}
          error={error}
          submitting={submitting}
          onCancel={() => setStep(1)}
          onConfirm={onConfirm}
        />
      )}

      <BidHistory entries={history} />
    </div>
  );
}
