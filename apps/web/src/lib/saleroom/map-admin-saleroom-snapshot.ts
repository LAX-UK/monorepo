import type { AdminSaleroomSessionSnapshot } from "@/lib/data/http/admin.server";
import { normalizeSessionStatus } from "@/lib/saleroom/normalize-session-status";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

export function mapAdminSaleroomSnapshotToSessionStatus(
  snapshot: AdminSaleroomSessionSnapshot,
): PublicSaleroomSessionStatus {
  return {
    status: normalizeSessionStatus(snapshot.session?.status),
    currentLotId: snapshot.session?.currentLotId ?? null,
  };
}
