"use client";

import { formatDisplayEstimate } from "@/features/saleroom/lib/display-bid-ticks";
import type { SaleroomDisplayNextLot } from "@auction/types";
import { useState } from "react";

type Props = {
  nextLot: SaleroomDisplayNextLot;
  /** compact = under current lot image on projector; default = transition / between-lots preview */
  variant?: "compact" | "default";
};

function NextLotImage({ imageUrl, title }: { imageUrl: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-white/30">No image</div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={title}
      className="h-full w-full object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function SaleroomDisplayNextLotCard({ nextLot, variant = "default" }: Props) {
  const estimateLabel = formatDisplayEstimate(nextLot.estimate);
  const compact = variant === "compact";

  return (
    <section
      className={
        compact
          ? "rounded-xl border border-white/10 bg-neutral-900/70 px-4 py-3"
          : "rounded-2xl border border-white/10 bg-neutral-900/50 p-5"
      }
    >
      <p
        className={
          compact
            ? "text-[10px] uppercase tracking-[0.25em] text-white/40"
            : "text-xs uppercase tracking-[0.25em] text-white/45"
        }
      >
        Up next
      </p>
      <div className={`flex items-center gap-3 ${compact ? "mt-2" : "mt-4 gap-4"}`}>
        <div
          className={
            compact
              ? "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-neutral-800"
              : "relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-800"
          }
        >
          {nextLot.imageUrl ? (
            <NextLotImage imageUrl={nextLot.imageUrl} title={nextLot.title} />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-white/30">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={
              compact
                ? "text-xs uppercase tracking-widest text-white/45"
                : "text-sm uppercase tracking-widest text-white/50"
            }
          >
            Lot {nextLot.lotNumber}
          </p>
          <p
            className={
              compact
                ? "line-clamp-1 text-base font-semibold leading-snug text-white/85"
                : "line-clamp-2 text-xl font-semibold leading-snug text-white/90"
            }
          >
            {nextLot.title}
          </p>
          {estimateLabel ? (
            <p className={`text-white/50 ${compact ? "mt-0.5 text-xs" : "mt-1 text-sm"}`}>
              Est. {estimateLabel}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
