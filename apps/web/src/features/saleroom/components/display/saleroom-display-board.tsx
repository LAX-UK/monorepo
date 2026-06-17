"use client";

import { SaleroomDisplayBidFeed } from "@/features/saleroom/components/display/saleroom-display-bid-feed";
import { SaleroomDisplayClock } from "@/features/saleroom/components/display/saleroom-display-clock";
import { SaleroomDisplayNextLotCard } from "@/features/saleroom/components/display/saleroom-display-next-lot";
import { SaleroomDisplayStandby } from "@/features/saleroom/components/display/saleroom-display-standby";
import {
  type DisplayBoardVM,
  type DisplayLastHammer,
  formatDisplayEstimate,
} from "@/features/saleroom/lib/display-bid-ticks";
import { PLATFORM_DEFAULT_CURRENCY } from "@/lib/money/currency";
import { formatMoney } from "@/lib/ui/format";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = DisplayBoardVM;

function StatusBadge({ status }: { status: DisplayBoardVM["snapshot"]["sessionStatus"] }) {
  const label =
    status === "live"
      ? "LIVE"
      : status === "paused"
        ? "PAUSED"
        : status === "ended"
          ? "ENDED"
          : "STANDBY";
  const tone =
    status === "live"
      ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/40"
      : status === "paused"
        ? "bg-amber-500/20 text-amber-100 border-amber-400/40"
        : "bg-white/10 text-white/70 border-white/20";
  return (
    <span className={`rounded-full border px-4 py-1 text-sm font-semibold tracking-widest ${tone}`}>
      {label}
    </span>
  );
}

function LotProgressChip({
  saleProgress,
}: {
  saleProgress: DisplayBoardVM["snapshot"]["saleProgress"];
}) {
  if (!saleProgress) {
    return null;
  }
  return (
    <span className="rounded-full border border-white/15 bg-white/5 dark:bg-white/5 px-4 py-1 text-sm font-medium tracking-wide text-white/70">
      Lot {saleProgress.position} of {saleProgress.total}
    </span>
  );
}

function LotImage({ imageUrl, title }: { imageUrl: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="flex h-full items-center justify-center text-white/30">No image</div>;
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

export function SaleroomDisplayBoard({
  snapshot,
  connectionStatus,
  recentBids,
  priceFlash,
  leaderLabel,
  nextRequiredBid,
  nextRequiredBidCurrency,
}: Props) {
  const lot = snapshot.currentLot;
  const betweenLots = snapshot.sessionStatus === "live" && !snapshot.currentLotId;
  const lotTransitioning =
    snapshot.sessionStatus === "live" && Boolean(snapshot.currentLotId) && !lot;
  const showFeed = Boolean(lot && snapshot.sessionStatus === "live");
  const showNextLot =
    snapshot.sessionStatus === "live" &&
    snapshot.nextLot != null &&
    !betweenLots &&
    !lotTransitioning;
  const estimateLabel = lot ? formatDisplayEstimate(lot.estimate) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-white">
      <header className="flex items-start justify-between gap-6 px-8 py-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">Saleroom display</p>
          <h1 className="text-2xl font-medium md:text-3xl">{snapshot.saleTitle}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <LotProgressChip saleProgress={snapshot.saleProgress} />
            <StatusBadge status={snapshot.sessionStatus} />
            {connectionStatus !== "connected" ? (
              <span className="text-xs uppercase tracking-wider text-amber-300">Reconnecting…</span>
            ) : null}
          </div>
          <SaleroomDisplayClock
            sessionStartedAt={snapshot.sessionStartedAt}
            sessionStatus={snapshot.sessionStatus}
          />
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-8 pb-12">
        {betweenLots ? (
          <SaleroomDisplayStandby
            saleId={snapshot.saleId}
            saleTitle={snapshot.saleTitle}
            coverImageUrl={snapshot.saleCoverImageUrl}
            headline="Between lots"
            subline={
              snapshot.nextLot
                ? `Up next — Lot ${snapshot.nextLot.lotNumber}: ${snapshot.nextLot.title}`
                : "Stand by for the next lot"
            }
          />
        ) : lotTransitioning ? (
          <div className="text-center">
            <p className="text-5xl font-light tracking-tight text-white/80">Next lot</p>
            <p className="mt-4 text-xl text-white/50">Loading…</p>
            {snapshot.nextLot ? (
              <div className="mx-auto mt-10 max-w-md">
                <SaleroomDisplayNextLotCard nextLot={snapshot.nextLot} />
              </div>
            ) : null}
          </div>
        ) : lot ? (
          <div className="grid w-full max-w-7xl grid-cols-1 items-start gap-10 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl ring-1 ring-white/10">
                {lot.imageUrl ? (
                  <LotImage imageUrl={lot.imageUrl} title={lot.title} />
                ) : (
                  <div className="flex h-full items-center justify-center text-white/30">
                    No image
                  </div>
                )}
              </div>
              {showNextLot && snapshot.nextLot ? (
                <SaleroomDisplayNextLotCard nextLot={snapshot.nextLot} variant="compact" />
              ) : null}
            </div>
            <div className="space-y-6">
              <p className="text-lg uppercase tracking-[0.25em] text-white/50">
                Lot {lot.lotNumber}
              </p>
              <h2 className="line-clamp-3 text-4xl font-semibold leading-tight md:text-5xl">
                {lot.title}
              </h2>
              {estimateLabel ? (
                <p className="text-lg text-white/55">Estimate {estimateLabel}</p>
              ) : null}
              <div>
                <p className="text-sm uppercase tracking-widest text-white/50">Current bid</p>
                <p
                  aria-live="polite"
                  aria-atomic="true"
                  className={`text-6xl font-bold tabular-nums tracking-tight md:text-7xl ${priceFlash ? "motion-safe:animate-[bidPriceBump_0.45s_ease-out]" : ""}`}
                >
                  {formatMoney(lot.currentPrice, nextRequiredBidCurrency)}
                </p>
                {nextRequiredBid ? (
                  <p className="mt-2 text-lg text-white/45">
                    Next bid{" "}
                    <span className="font-semibold tabular-nums text-white/70">
                      {formatMoney(nextRequiredBid, nextRequiredBidCurrency)}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-8 text-lg text-white/70">
                <Stat label="Bids" value={String(lot.bidCount)} />
                {leaderLabel ? <Stat label="Leading" value={leaderLabel} /> : null}
              </div>
              {showFeed ? (
                <SaleroomDisplayBidFeed
                  recentBids={recentBids}
                  leaderPaddleNumber={lot.leaderPaddleNumber}
                  bidCount={lot.bidCount}
                  bidCurrency={nextRequiredBidCurrency}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <SaleroomDisplayStandby
            saleId={snapshot.saleId}
            saleTitle={snapshot.saleTitle}
            coverImageUrl={snapshot.saleCoverImageUrl}
            headline="Awaiting session"
            subline="The saleroom will appear here when live"
          />
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-white/40">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

export type OverlayKind = "fair_warning" | "sold" | "passed" | "announcement" | "idle";

type OverlayProps = {
  overlay: { kind: "fair_warning" | "announcement"; message?: string } | null;
  flash: "sold" | "passed" | null;
  betweenLots: boolean;
  lastHammer: DisplayLastHammer | null;
  priceCurrency?: string;
};

const overlayRenderers: Record<OverlayKind, (props: OverlayProps) => ReactNode> = {
  fair_warning: (props) =>
    props.overlay?.kind === "fair_warning" ? (
      <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-amber-500/20 backdrop-blur-sm">
        <p className="animate-pulse text-6xl font-black uppercase tracking-[0.3em] text-amber-100 md:text-8xl">
          Fair warning
        </p>
      </div>
    ) : null,
  announcement: (props) =>
    props.overlay?.kind === "announcement" ? (
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 bg-neutral-900/90 px-8 py-6 text-center">
        <p className="text-2xl font-medium text-white md:text-3xl">
          {props.overlay.message ?? "Announcement"}
        </p>
      </div>
    ) : null,
  sold: (props) =>
    props.flash === "sold" ? (
      <div className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600/30 backdrop-blur-[2px]">
        <p className="text-7xl font-black uppercase tracking-[0.2em] text-white md:text-9xl">
          Sold
        </p>
        {props.lastHammer ? (
          <div className="mt-8 text-center">
            <p className="text-4xl font-bold tabular-nums text-white md:text-5xl">
              {formatMoney(
                props.lastHammer.price,
                props.priceCurrency ?? PLATFORM_DEFAULT_CURRENCY,
              )}
            </p>
            {props.lastHammer.paddleLabel ? (
              <p className="mt-3 text-xl uppercase tracking-widest text-white/80">
                {props.lastHammer.paddleLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null,
  passed: (props) =>
    props.flash === "passed" ? (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-neutral-700/50">
        <p className="text-6xl font-black uppercase tracking-[0.2em] text-white/90 md:text-8xl">
          Passed
        </p>
      </div>
    ) : null,
  idle: (props) =>
    props.betweenLots ? (
      <div className="pointer-events-none fixed bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-full bg-neutral-100/10 px-6 py-2 text-sm uppercase tracking-widest text-white/60">
        Between lots
      </div>
    ) : null,
};

export function SaleroomDisplayOverlay({
  overlay,
  flash,
  betweenLots,
  lastHammer,
  priceCurrency = PLATFORM_DEFAULT_CURRENCY,
}: OverlayProps) {
  return (
    <>
      {overlayRenderers.fair_warning({ overlay, flash, betweenLots, lastHammer, priceCurrency })}
      {overlayRenderers.announcement({ overlay, flash, betweenLots, lastHammer, priceCurrency })}
      {overlayRenderers.sold({ overlay, flash, betweenLots, lastHammer, priceCurrency })}
      {overlayRenderers.passed({ overlay, flash, betweenLots, lastHammer, priceCurrency })}
      {overlayRenderers.idle({ overlay, flash, betweenLots, lastHammer, priceCurrency })}
    </>
  );
}
