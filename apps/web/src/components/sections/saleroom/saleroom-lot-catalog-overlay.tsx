"use client";

import { formatRemaining } from "@/components/lot-timer/format";
import { LotTimerPill } from "@/components/lot-timer/lot-timer-pill";
import type { SaleLotCardVM } from "@/components/sections/saleroom/view-models";
import { useNow } from "@/hooks/use-now";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import { resolveCatalogLotOverlay } from "@/lib/lot/catalog-lot-overlay";
import type { Sale } from "@auction/types";
import { StatusBadge, cn } from "@auction/ui";
import { useMemo } from "react";

export type SaleroomSaleForLifecycle =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

type Props = {
  lot: SaleLotCardVM;
  saleForLifecycle: SaleroomSaleForLifecycle;
  /** `overlay` for image cards; `inline` for list rows. */
  layout?: "overlay" | "inline";
  /** When true, use adaptive overlay chrome from AdaptiveMediaFrame. */
  useOverlayChrome?: boolean;
};

const SALEROOM_PILL_OVERLAY =
  "pointer-events-none absolute bottom-3 left-3 z-10 inline-flex max-w-[calc(100%-1.5rem)]";
const SALEROOM_PILL_INLINE = "relative inline-flex max-w-full shrink-0 pointer-events-auto";
const SALEROOM_PILL_SHELL =
  "items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-[0.1em] backdrop-blur-sm";
const SALEROOM_PILL_MUTED =
  "bg-brand-900/70 text-white/70 dark:border-transparent dark:bg-black/70 dark:text-white/70";
const SALEROOM_PILL_LIVE =
  "bg-brand-600/90 text-white dark:border-transparent dark:bg-brand-600/90 dark:text-white";

function SaleroomLabelPill({
  label,
  layout,
  tone = "muted",
  useOverlayChrome,
}: {
  label: string;
  layout: "overlay" | "inline";
  tone?: "live" | "muted";
  useOverlayChrome?: boolean;
}) {
  const inline = layout === "inline";
  return (
    <output
      aria-live="off"
      aria-label={label}
      className={cn(
        inline ? SALEROOM_PILL_INLINE : SALEROOM_PILL_OVERLAY,
        SALEROOM_PILL_SHELL,
        tone === "live" ? SALEROOM_PILL_LIVE : SALEROOM_PILL_MUTED,
        useOverlayChrome &&
          !inline &&
          tone === "muted" &&
          "border-[color:var(--overlay-border)] bg-[color:var(--overlay-bg)] text-[color:var(--overlay-fg)]",
      )}
    >
      {label}
    </output>
  );
}

export function SaleroomLotCatalogOverlay({
  lot,
  saleForLifecycle,
  layout = "overlay",
  useOverlayChrome = false,
}: Props) {
  const now = useNow(1000);
  const saleroomLive = useSaleroomLive();
  const isOnBlock = lot.isOnBlock ?? saleroomLive?.isLotOnBlock(lot.id) ?? false;
  const isUpNext = lot.isUpNext ?? saleroomLive?.isLotUpNext(lot.id) ?? false;

  const overlay = useMemo(() => {
    if (now == null) return null;
    return resolveCatalogLotOverlay({
      lot: {
        id: lot.id,
        status: lot.status,
        startTime: lot.startTime ?? new Date(),
        endTime: lot.endTime ?? new Date(),
        winnerId: lot.winnerId ?? null,
        ...(lot.hasWinner !== undefined ? { hasWinner: lot.hasWinner } : {}),
        currentPrice: lot.currentBidValue,
      },
      sale: saleForLifecycle,
      nowMs: now,
      saleroomSessionActive: saleroomLive?.isSessionLive ?? false,
      saleroomSessionPaused: saleroomLive?.status === "paused",
      isOnBlock,
      isUpNext,
    });
  }, [lot, saleForLifecycle, now, saleroomLive, isOnBlock, isUpNext]);

  if (overlay == null || overlay.kind === "hidden") {
    return null;
  }

  const pillLayout = layout;
  const overlayChrome = useOverlayChrome && layout === "overlay";

  if (overlay.kind === "saleroom") {
    return (
      <SaleroomLabelPill
        label={overlay.label}
        tone={overlay.tone}
        layout={pillLayout}
        useOverlayChrome={overlayChrome}
      />
    );
  }

  if (overlay.kind === "timer") {
    const clockText =
      overlay.timerState.kind === "live" || overlay.timerState.kind === "opensSoon"
        ? formatRemaining(overlay.timerState.msLeft)
        : undefined;
    return (
      <LotTimerPill
        state={overlay.timerState}
        {...(clockText !== undefined ? { clockText } : {})}
        layout={pillLayout}
        useOverlayChrome={overlayChrome}
      />
    );
  }

  const { presentation } = overlay;
  if (layout === "overlay") {
    return (
      <SaleroomLabelPill
        label={presentation.label}
        layout={pillLayout}
        useOverlayChrome={overlayChrome}
      />
    );
  }

  return (
    <StatusBadge
      variant={presentation.variant}
      size="sm"
      {...(presentation.dot ? { dot: true } : {})}
      className="max-w-full normal-case"
    >
      <span className="truncate">{presentation.label}</span>
    </StatusBadge>
  );
}
