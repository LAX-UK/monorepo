"use client";

import { formatMoney } from "@/lib/ui/format";
import type { SaleroomDisplaySnapshot } from "@auction/types";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  snapshot: SaleroomDisplaySnapshot;
  connectionStatus: "connected" | "reconnecting" | "disconnected";
};

function StatusBadge({ status }: { status: SaleroomDisplaySnapshot["sessionStatus"] }) {
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

export function SaleroomDisplayBoard({ snapshot, connectionStatus }: Props) {
  const lot = snapshot.currentLot;
  const betweenLots = snapshot.sessionStatus === "live" && !snapshot.currentLotId;

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-950 text-white">
      <header className="flex items-center justify-between px-8 py-6">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-white/50">Saleroom display</p>
          <h1 className="text-2xl font-medium">{snapshot.saleTitle}</h1>
        </div>
        <div className="flex items-center gap-4">
          <StatusBadge status={snapshot.sessionStatus} />
          {connectionStatus !== "connected" ? (
            <span className="text-xs uppercase tracking-wider text-amber-300">Reconnecting…</span>
          ) : null}
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-8 pb-12">
        {betweenLots ? (
          <div className="text-center">
            <p className="text-5xl font-light tracking-tight text-white/80">Between lots</p>
            <p className="mt-4 text-xl text-white/50">Stand by for the next lot</p>
          </div>
        ) : lot ? (
          <div className="grid w-full max-w-7xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl">
              {lot.imageUrl ? (
                <LotImage imageUrl={lot.imageUrl} title={lot.title} />
              ) : (
                <div className="flex h-full items-center justify-center text-white/30">
                  No image
                </div>
              )}
            </div>
            <div className="space-y-6">
              <p className="text-lg uppercase tracking-[0.25em] text-white/50">
                Lot {lot.lotNumber}
              </p>
              <h2 className="text-4xl font-semibold leading-tight md:text-5xl">{lot.title}</h2>
              <div>
                <p className="text-sm uppercase tracking-widest text-white/50">Current bid</p>
                <p className="text-6xl font-bold tabular-nums md:text-7xl">
                  {formatMoney(lot.currentPrice)}
                </p>
              </div>
              <div className="flex flex-wrap gap-8 text-lg text-white/70">
                <Stat label="Bids" value={String(lot.bidCount)} />
                {lot.leaderPaddleNumber != null ? (
                  <Stat label="Leading paddle" value={String(lot.leaderPaddleNumber)} />
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-4xl font-light text-white/70">Awaiting session</p>
            <p className="mt-3 text-lg text-white/40">The saleroom will appear here when live</p>
          </div>
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
      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-emerald-600/30">
        <p className="text-7xl font-black uppercase tracking-[0.2em] text-white md:text-9xl">
          Sold
        </p>
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

export function SaleroomDisplayOverlay({ overlay, flash, betweenLots }: OverlayProps) {
  return (
    <>
      {overlayRenderers.fair_warning({ overlay, flash, betweenLots })}
      {overlayRenderers.announcement({ overlay, flash, betweenLots })}
      {overlayRenderers.sold({ overlay, flash, betweenLots })}
      {overlayRenderers.passed({ overlay, flash, betweenLots })}
      {overlayRenderers.idle({ overlay, flash, betweenLots })}
    </>
  );
}
