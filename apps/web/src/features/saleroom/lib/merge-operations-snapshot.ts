import type { StaffOpsPanelVM } from "@/features/saleroom/types/staff-saleroom.vm";
import { normalizeSessionStatus } from "@/lib/saleroom/normalize-session-status";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { AdminSaleOperationsSnapshot } from "@/lib/telephone/telephone-booking-types";
import type { Lot, SaleDeliveryMode } from "@auction/types";

export function operationsSnapshotToSessionStatus(
  snapshot: AdminSaleOperationsSnapshot,
): PublicSaleroomSessionStatus {
  return {
    status: normalizeSessionStatus(snapshot.saleroomSession?.status),
    currentLotId: snapshot.saleroomSession?.currentLotId ?? null,
  };
}

export type LiveBidOverlay = {
  currentPrice: string | null;
  bidCount: number | null;
  leaderLabel: string | null;
};

export type LiveSessionOverlay = {
  status: PublicSaleroomSessionStatus["status"];
  currentLotId: string | null;
  connectionStatus: StaffOpsPanelVM["connectionStatus"];
  lastEventAt: string | null;
};

export function resolveLotOnBlock(
  currentLotId: string | null,
  lots: readonly Lot[],
  snapshotFallback: { lotNumber: number | null; lotTitle: string | null },
): { lotNumber: number | null; lotTitle: string | null } {
  if (!currentLotId) {
    return { lotNumber: null, lotTitle: null };
  }
  const lot = lots.find((entry) => entry.id === currentLotId);
  if (lot) {
    const title = lot.title?.trim();
    return {
      lotNumber: lot.lotNumber ?? null,
      lotTitle: title || `Lot ${currentLotId.slice(0, 8)}…`,
    };
  }
  return snapshotFallback;
}

export function mergeOperationsSnapshot(
  snapshot: AdminSaleOperationsSnapshot,
  sessionOverlay: LiveSessionOverlay,
  bidOverlay: LiveBidOverlay,
  checkedInPaddleCount = 0,
  lots: readonly Lot[] = [],
): StaffOpsPanelVM {
  const sessionStatus = sessionOverlay.status;
  const saleroom = snapshot.saleroomSession;
  const currentLotId = sessionOverlay.currentLotId ?? saleroom?.currentLotId ?? null;
  const lotMeta = resolveLotOnBlock(currentLotId, lots, {
    lotNumber: saleroom?.currentLotNumber ?? null,
    lotTitle: saleroom?.currentLotTitle ?? null,
  });

  return {
    saleId: snapshot.sale.id,
    saleTitle: snapshot.sale.title,
    saleStatus: snapshot.sale.status,
    deliveryMode: snapshot.sale.deliveryMode as SaleDeliveryMode,
    sessionStatus,
    currentLotId,
    currentLotNumber: lotMeta.lotNumber,
    currentLotTitle: lotMeta.lotTitle,
    currentPrice: bidOverlay.currentPrice ?? snapshot.currentLotBidding?.currentPrice ?? null,
    bidCount: bidOverlay.bidCount ?? snapshot.currentLotBidding?.bidCount ?? null,
    leaderLabel: bidOverlay.leaderLabel ?? snapshot.currentLotBidding?.leaderRef ?? null,
    pendingRegistrations: snapshot.registrations.pending,
    pendingTelephone: snapshot.telephoneBookings.requested,
    inProgressTelephone: snapshot.telephoneBookings.inProgress,
    checkedInPaddleCount,
    connectionStatus: sessionOverlay.connectionStatus,
    lastEventAt: sessionOverlay.lastEventAt,
    pendingTelephoneRows: snapshot.pendingActions.telephone,
  };
}

export function shouldShowRadarRow(input: {
  deliveryMode: SaleDeliveryMode;
  pendingRegistrations: number;
  pendingTelephone: number;
  inProgressTelephone: number;
  sessionStatus: string | null;
}): boolean {
  const isSaleroom = input.deliveryMode === "onsite" || input.deliveryMode === "hybrid";
  if (!isSaleroom) return false;

  const hasPendingWork =
    input.pendingRegistrations > 0 || input.pendingTelephone > 0 || input.inProgressTelephone > 0;

  const isLiveSession = input.sessionStatus === "live" || input.sessionStatus === "paused";

  return hasPendingWork || isLiveSession;
}
