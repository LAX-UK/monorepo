import type { LotTimerState } from "@/lib/lot/classify-lot-timer-state";
import { type LotLifecycleKind, classifyLotLifecycle } from "@/lib/lot/lot-lifecycle";
import type { StatusPresentation } from "@/lib/presenters/status-presentation";
import { resolveLotStatusPresentation } from "@/lib/presenters/status-presentation";
import type { Lot, LotStatus, Sale } from "@auction/types";

type CatalogLotOverlayLot = Pick<Lot, "id" | "status" | "winnerId"> & {
  startTime: Lot["startTime"] | string | null;
  endTime: Lot["endTime"] | string | null;
  hasWinner?: boolean;
  currentPrice?: string;
};

type CatalogLotOverlaySale =
  | (Pick<Sale, "status" | "deliveryMode"> & Partial<Pick<Sale, "allowOnlineBidsBeforeGoLive">>)
  | null;

export type CatalogLotOverlayVM =
  | { kind: "hidden" }
  | {
      kind: "saleroom";
      label: "In saleroom" | "Up next" | "Paused";
      tone: "live" | "muted";
    }
  | { kind: "timer"; timerState: LotTimerState; msLeft: number | null }
  | { kind: "status"; presentation: StatusPresentation };

export type ResolveCatalogLotOverlayInput = {
  lot: CatalogLotOverlayLot;
  sale: CatalogLotOverlaySale;
  nowMs: number;
  saleroomSessionActive?: boolean;
  saleroomSessionPaused?: boolean;
  isOnBlock?: boolean;
  isUpNext?: boolean;
  recentlyExtended?: boolean;
};

function timerStateForLifecycle(
  kind: LotLifecycleKind,
  msLeft: number | null,
): LotTimerState | null {
  switch (kind) {
    case "live":
    case "extended":
      return msLeft != null ? { kind: "live", msLeft } : { kind: "unknown" };
    case "scheduled":
      return msLeft != null ? { kind: "opensSoon", msLeft } : { kind: "unknown" };
    default:
      return null;
  }
}

function statusPresentationForLifecycle(
  kind: LotLifecycleKind,
  lot: CatalogLotOverlayLot,
): StatusPresentation {
  switch (kind) {
    case "endedSold":
      return resolveLotStatusPresentation("ended", {
        winnerId: lot.winnerId ?? null,
        ...(lot.hasWinner !== undefined ? { hasWinner: lot.hasWinner } : {}),
      });
    case "endedNoSale":
      return resolveLotStatusPresentation("ended", {
        winnerId: null,
        hasWinner: false,
      });
    case "cancelled":
      return resolveLotStatusPresentation("cancelled");
    case "withdrawn":
      return resolveLotStatusPresentation("voided");
    case "preLaunch":
      return { label: "Soon", variant: "neutral" };
    default:
      return resolveLotStatusPresentation(lot.status as LotStatus, {
        ...(lot.winnerId !== undefined ? { winnerId: lot.winnerId } : {}),
        ...(lot.hasWinner !== undefined ? { hasWinner: lot.hasWinner } : {}),
      });
  }
}

function normalizeLotForLifecycle(
  lot: CatalogLotOverlayLot,
): Pick<Lot, "status" | "startTime" | "endTime" | "winnerId" | "currentPrice" | "id"> {
  return {
    id: lot.id,
    status: lot.status,
    winnerId: lot.winnerId ?? null,
    currentPrice: lot.currentPrice ?? "",
    startTime:
      lot.startTime instanceof Date ? lot.startTime : new Date(lot.startTime ?? Date.now()),
    endTime: lot.endTime instanceof Date ? lot.endTime : new Date(lot.endTime ?? Date.now()),
  };
}

/** Maps saleroom-aware lifecycle to catalog card overlay presentation. */
export function resolveCatalogLotOverlay(
  input: ResolveCatalogLotOverlayInput,
): CatalogLotOverlayVM {
  const lifecycle = classifyLotLifecycle(
    normalizeLotForLifecycle(input.lot),
    input.sale,
    input.nowMs,
    {
      ...(input.recentlyExtended !== undefined ? { recentlyExtended: input.recentlyExtended } : {}),
      ...(input.saleroomSessionActive !== undefined
        ? { saleroomSessionActive: input.saleroomSessionActive }
        : {}),
      ...(input.saleroomSessionPaused !== undefined
        ? { saleroomSessionPaused: input.saleroomSessionPaused }
        : {}),
      ...(input.isOnBlock !== undefined ? { isOnBlock: input.isOnBlock } : {}),
    },
  );

  if (lifecycle.kind === "liveSaleroom") {
    if (input.isOnBlock) {
      return { kind: "hidden" };
    }
    if (input.isUpNext) {
      return { kind: "saleroom", label: "Up next", tone: "live" };
    }
    return { kind: "saleroom", label: "In saleroom", tone: "muted" };
  }

  if (lifecycle.kind === "saleroomPaused") {
    return { kind: "saleroom", label: "Paused", tone: "muted" };
  }

  const timerState = timerStateForLifecycle(lifecycle.kind, lifecycle.msLeft);
  if (timerState != null) {
    return { kind: "timer", timerState, msLeft: lifecycle.msLeft };
  }

  return {
    kind: "status",
    presentation: statusPresentationForLifecycle(lifecycle.kind, input.lot),
  };
}
