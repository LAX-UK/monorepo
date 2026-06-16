"use client";

import {
  type DisplayBidTick,
  formatDisplayLeaderLabel,
} from "@/features/saleroom/lib/display-bid-ticks";
import { formatMoney } from "@/lib/ui/format";

type Props = {
  recentBids: DisplayBidTick[];
  leaderPaddleNumber: number | null;
  bidCount: number;
};

function rowLabel(tick: DisplayBidTick, leaderPaddleNumber: number | null, isLeading: boolean) {
  if (isLeading) {
    return formatDisplayLeaderLabel(tick.placedVia, leaderPaddleNumber) ?? "Bidder";
  }
  return formatDisplayLeaderLabel(tick.placedVia, null) ?? "Bidder";
}

export function SaleroomDisplayBidFeed({ recentBids, leaderPaddleNumber, bidCount }: Props) {
  return (
    <section
      className="min-h-[280px] rounded-2xl border border-white/10 bg-neutral-900/60 p-6"
      aria-live="polite"
      aria-relevant="additions"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm uppercase tracking-[0.25em] text-white/50">Recent bids</p>
        <p className="text-sm tabular-nums text-white/40">
          {bidCount} bid{bidCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {recentBids.length === 0 ? (
          <p className="py-8 text-center text-lg text-white/40">
            {bidCount === 0 ? "Waiting for bids…" : "Live bidding in progress"}
          </p>
        ) : (
          recentBids.map((tick, index) => {
            const isLeading = index === 0;
            const label = rowLabel(tick, leaderPaddleNumber, isLeading);

            return (
              <div
                key={tick.id}
                className={
                  isLeading
                    ? "motion-safe:animate-artwork-slide-up-fade flex items-center justify-between gap-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-4 motion-reduce:opacity-100"
                    : "motion-safe:animate-artwork-slide-up-fade flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-neutral-950/40 px-5 py-4 motion-reduce:opacity-100"
                }
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-widest text-white/45">
                    {isLeading ? "Leading" : "Bid"}
                  </p>
                  <p className="truncate text-2xl font-semibold text-white">{label}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums text-white">
                    {formatMoney(tick.amount)}
                  </p>
                  {tick.isAutoBid ? (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-emerald-200/80">
                      Auto
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
