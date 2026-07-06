import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import type { SaleroomRealtimePayload } from "@auction/types";

function applyNextLotId(
  prev: PublicSaleroomSessionStatus,
  event: SaleroomRealtimePayload,
): string | null | undefined {
  if (event.nextLotId !== undefined) {
    return event.nextLotId;
  }
  return prev.nextLotId;
}

export function applySaleroomEvent(
  prev: PublicSaleroomSessionStatus,
  event: SaleroomRealtimePayload,
): PublicSaleroomSessionStatus {
  switch (event.kind) {
    case "opened":
      return {
        ...prev,
        status: "live",
        nextLotId: applyNextLotId(prev, event) ?? null,
      };
    case "paused":
      return {
        ...prev,
        status: "paused",
        nextLotId: applyNextLotId(prev, event) ?? null,
      };
    case "resumed":
      return {
        ...prev,
        status: "live",
        nextLotId: applyNextLotId(prev, event) ?? null,
      };
    case "closed":
      return { status: "ended", currentLotId: null, nextLotId: null };
    case "advanced_to_lot":
      return {
        ...prev,
        status: prev.status === "none" ? "live" : prev.status,
        currentLotId: event.lotId ?? null,
        nextLotId: applyNextLotId(prev, event) ?? null,
      };
    case "hammer":
    case "no_sale":
      return {
        ...prev,
        currentLotId: null,
        nextLotId: applyNextLotId(prev, event) ?? null,
      };
    default:
      return prev;
  }
}
