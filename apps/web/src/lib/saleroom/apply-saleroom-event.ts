import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleroomRealtimePayload } from "@auction/types";

export function applySaleroomEvent(
  prev: PublicSaleroomSessionStatus,
  event: SaleroomRealtimePayload,
): PublicSaleroomSessionStatus {
  switch (event.kind) {
    case "opened":
      return { ...prev, status: "live" };
    case "paused":
      return { ...prev, status: "paused" };
    case "resumed":
      return { ...prev, status: "live" };
    case "closed":
      return { status: "ended", currentLotId: null };
    case "advanced_to_lot":
      return {
        ...prev,
        status: prev.status === "none" ? "live" : prev.status,
        currentLotId: event.lotId ?? null,
      };
    case "hammer":
    case "no_sale":
      return { ...prev, currentLotId: null };
    default:
      return prev;
  }
}
