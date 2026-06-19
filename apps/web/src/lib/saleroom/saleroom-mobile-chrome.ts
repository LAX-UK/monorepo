import type { SaleroomSessionStatus } from "@/lib/presenters/status-presentation";
import { isLotRunCompleted } from "@/lib/saleroom/lot-run-progress";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import {
  isSaleroomSessionActive,
  isSaleroomSessionLive,
} from "@/lib/saleroom/public-session-status";
import type { LotStatus } from "@auction/types";

/** Map public buyer saleroom session status to registry `saleroomSession` domain keys. */
export function publicSaleroomSessionToRegistryStatus(
  status: PublicSaleroomSessionStatus["status"],
): SaleroomSessionStatus {
  switch (status) {
    case "live":
      return "live";
    case "paused":
      return "paused";
    case "ended":
      return "closed";
    case "none":
    case "pending":
      return "idle";
    default:
      return "idle";
  }
}

/** Minimal lot ref for saleroom on-block UX (banner, bottom bar, lot detail nudge). */
export type SaleroomLotRef = {
  id: string;
  lotNumber: number | null;
  title: string;
  href: string;
  status?: string;
};

/** @deprecated Use `SaleroomLotRef`. */
export type SaleroomOnBlockLotRef = SaleroomLotRef;

/** @deprecated Use `SaleroomLotRef`. */
export type SaleroomLiveLotRef = SaleroomLotRef;

export type SaleroomLotProgress = {
  completedLots: number;
  totalLots: number;
};

export function countSaleroomLotProgress(lots: readonly SaleroomLotRef[]): SaleroomLotProgress {
  return {
    totalLots: lots.length,
    completedLots: lots.filter((l) => (l.status ? isLotRunCompleted(l.status as LotStatus) : false))
      .length,
  };
}

export function formatSaleroomOnBlockLabel(
  lot: Pick<SaleroomLotRef, "lotNumber" | "title">,
): string {
  return lot.lotNumber != null ? `Lot ${lot.lotNumber}` : lot.title;
}

export function saleroomLiveProgressLabel(
  completedLots: number,
  totalLots: number,
  hasCurrentLot: boolean,
): string | null {
  if (totalLots <= 0) return null;
  return `${completedLots + (hasCurrentLot ? 1 : 0)} of ${totalLots} lots`;
}

export function saleroomLiveNoLotProgressLabel(completedLots: number, totalLots: number): string {
  return `${completedLots} of ${totalLots} lots complete`;
}

export type SaleroomCaptionParts = {
  headline: string;
  detail?: string;
};

export function saleroomOnBlockCaption(
  lot: Pick<SaleroomLotRef, "lotNumber" | "title">,
  progressLabel: string | null,
): SaleroomCaptionParts {
  return {
    headline: `${formatSaleroomOnBlockLabel(lot)} is on the block`,
    ...(progressLabel ? { detail: progressLabel } : {}),
  };
}

export function saleroomPausedCaption(
  onBlockLot: Pick<SaleroomLotRef, "lotNumber" | "title"> | null,
): SaleroomCaptionParts {
  return {
    headline: "Auction paused",
    ...(onBlockLot ? { detail: `${formatSaleroomOnBlockLabel(onBlockLot)} was on the block` } : {}),
  };
}

export function saleroomLiveNoLotCaption(completedLots: number, totalLots: number): string {
  return `Saleroom live · ${saleroomLiveNoLotProgressLabel(completedLots, totalLots)}`;
}

/** Shared bid CTA styling for saleroom on-block surfaces. */
export const saleroomBidNowCtaClassName =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm bg-cta-bg px-4 py-3 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-cta-on";

export type SaleroomMobileSummaryBarMode =
  | { kind: "on_block"; lot: SaleroomLotRef; progressLabel: string | null }
  | { kind: "paused"; onBlockLot: SaleroomLotRef | null }
  | { kind: "live_no_lot"; progressLabel: string };

export function resolveSaleroomMobileSummaryBarMode(
  sessionStatus: PublicSaleroomSessionStatus["status"],
  currentLotId: string | null,
  lots: readonly SaleroomLotRef[],
): SaleroomMobileSummaryBarMode | null {
  if (!isSaleroomSessionActive(sessionStatus)) return null;

  const onBlockLot =
    currentLotId != null ? (lots.find((l) => l.id === currentLotId) ?? null) : null;
  const { completedLots, totalLots } = countSaleroomLotProgress(lots);

  if (sessionStatus === "paused") {
    return { kind: "paused", onBlockLot };
  }

  if (!isSaleroomSessionLive(sessionStatus)) return null;

  if (onBlockLot) {
    return {
      kind: "on_block",
      lot: onBlockLot,
      progressLabel: saleroomLiveProgressLabel(completedLots, totalLots, true),
    };
  }

  if (currentLotId == null && totalLots > 0) {
    return {
      kind: "live_no_lot",
      progressLabel: saleroomLiveNoLotProgressLabel(completedLots, totalLots),
    };
  }

  return null;
}
