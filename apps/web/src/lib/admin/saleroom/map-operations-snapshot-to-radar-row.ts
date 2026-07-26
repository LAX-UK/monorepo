import { shouldShowRadarRow } from "@/features/saleroom/lib/merge-operations-snapshot";
import type { RadarRowVM } from "@/features/saleroom/types/staff-saleroom.vm";
import type { AdminSaleOperationsSnapshot } from "@/lib/data/http/admin.server";
import type { SaleDeliveryMode } from "@auction/types";
import { isSaleroomDeliveryMode } from "@auction/validators";

export type OnsiteSalesRadarRow = RadarRowVM;

export function mapOperationsSnapshotToRadarRow(
  snapshot: AdminSaleOperationsSnapshot,
): OnsiteSalesRadarRow | null {
  const deliveryMode = snapshot.sale.deliveryMode as SaleDeliveryMode;
  if (!isSaleroomDeliveryMode(deliveryMode)) {
    return null;
  }

  const pendingRegistrations = snapshot.registrations.pending;
  const pendingTelephone = snapshot.telephoneBookings.requested;
  const inProgressTelephone = snapshot.telephoneBookings.inProgress;
  const sessionStatus = snapshot.saleroomSession?.status ?? null;

  if (
    !shouldShowRadarRow({
      deliveryMode,
      pendingRegistrations,
      pendingTelephone,
      inProgressTelephone,
      sessionStatus,
    })
  ) {
    return null;
  }

  const isLiveSession = sessionStatus === "live" || sessionStatus === "paused";
  const needsClosing = isLiveSession && snapshot.sale.status === "ended";

  return {
    saleId: snapshot.sale.id,
    title: snapshot.sale.title,
    status: snapshot.sale.status,
    deliveryMode,
    pendingRegistrations,
    pendingTelephone,
    inProgressTelephone,
    sessionStatus,
    currentLotTitle: snapshot.saleroomSession?.currentLotTitle ?? null,
    isLiveSession,
    needsClosing,
  };
}
