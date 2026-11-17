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

/**
 * True when a hammer/no_sale event resolves the lot this client has on the block.
 *
 * An outcome for an earlier lot can arrive after the room has already advanced (the advance and
 * the outcome publish independently). The server leaves the newer lot on the block in that case,
 * so the client must too. `clearedFromBlock: false` is the server saying so explicitly; older
 * servers omit it, and then the lot id comparison alone decides. An event with no `lotId` (very
 * old payloads) is treated as resolving the current lot.
 */
export function isOutcomeForCurrentLot(
  currentLotId: string | null | undefined,
  event: SaleroomRealtimePayload,
): boolean {
  if (event.kind !== "hammer" && event.kind !== "no_sale") return false;
  if (event.clearedFromBlock === false) return false;
  if (event.lotId === undefined) return true;
  return event.lotId === currentLotId;
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
        currentLotId: isOutcomeForCurrentLot(prev.currentLotId, event) ? null : prev.currentLotId,
        nextLotId: applyNextLotId(prev, event) ?? null,
      };
    default:
      return prev;
  }
}
