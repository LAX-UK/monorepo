"use client";

import { Button } from "@/components/ui/button";
import { UnderlineInput } from "@/components/ui/input";
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

export function ArtworkBidPanel({ auction }: Props) {
  const { bidWriter } = useAuctionPorts();
  const [currentPrice, setCurrentPrice] = useState(auction.currentPrice);
  const [endTime, setEndTime] = useState(() => new Date(auction.endTime).getTime());
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const minNumeric = useMemo(() => Number.parseFloat(currentPrice) + 0.01, [currentPrice]);

  useAuctionRealtime(auction.id, {
    onBidUpdate: (e) => {
      setCurrentPrice(e.currentPrice);
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
    setAmount("");
    setStep(1);
  }, [amount, auction.id, bidWriter]);

  return (
    <div className="mb-20 border border-stone-200/60 bg-surface-container-lowest p-8 shadow-sm lg:p-12">
      <div className="mb-12 flex items-end justify-between">
        <div>
          <span className="mb-2 block font-label text-[10px] uppercase tracking-widest text-secondary">
            Current High Bid
          </span>
          <span className="font-headline text-5xl text-primary">{formatMoney(currentPrice)}</span>
        </div>
        <div className="text-right">
          <span className="mb-2 block font-label text-[10px] uppercase tracking-widest text-secondary">
            Time Remaining
          </span>
          <span className="font-headline tabular-nums text-2xl text-on-surface">
            {formatRemaining(endTime - now)}
          </span>
        </div>
      </div>

      {auction.status !== "active" ? (
        <p className="font-body text-secondary">This auction is not accepting bids.</p>
      ) : step === 1 ? (
        <div className="space-y-8">
          <div>
            <label
              htmlFor="bid-amount"
              className="mb-4 block font-label text-[10px] uppercase tracking-widest text-stone-400"
            >
              Enter bid amount (min. {formatMoney(minNumeric.toFixed(2))})
            </label>
            <div className="flex items-center border-b-2 border-stone-200 py-4 transition-colors focus-within:border-primary">
              <span className="mr-4 font-headline text-2xl">$</span>
              <UnderlineInput
                id="bid-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-0 p-0 text-3xl focus:shadow-none"
              />
            </div>
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <Button type="button" variant="primary" className="w-full py-6" onClick={onReview}>
            Review bid amount
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="border-l-4 border-primary bg-stone-50 p-6">
            <p className="mb-1 font-label text-xs uppercase tracking-widest text-stone-500">
              Confirming your bid of
            </p>
            <p className="font-headline text-3xl text-primary">{formatMoney(amount)}</p>
            <p className="mt-4 font-label text-[10px] leading-relaxed text-stone-400">
              By placing a bid you agree to the terms of sale. Authentication may be required for
              high-value lots.
            </p>
          </div>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 py-6"
              onClick={() => setStep(1)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              className="flex-1 py-6"
              disabled={submitting}
              onClick={() => void onConfirm()}
            >
              {submitting ? "Submitting…" : "Place bid"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
