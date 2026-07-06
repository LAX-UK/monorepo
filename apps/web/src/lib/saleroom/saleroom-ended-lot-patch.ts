import type { LotStatus } from "@auction/types";
import type { SaleroomRealtimePayload } from "@auction/types";

export type SaleroomEndedLotPatch = {
  status: Extract<LotStatus, "ended" | "voided">;
  winnerId: string | null;
  hasWinner: boolean;
};

/** Derive a catalog lot patch from hammer/no_sale saleroom events. */
export function extractSaleroomEndedLotPatch(
  event: SaleroomRealtimePayload,
): SaleroomEndedLotPatch | null {
  if (event.kind !== "hammer" && event.kind !== "no_sale") return null;
  if (!event.lotId) return null;

  const status: SaleroomEndedLotPatch["status"] = event.lotStatus === "voided" ? "voided" : "ended";
  const winnerId = event.winnerId ?? null;
  const hasWinner = event.lotOutcome === "sold" || Boolean(winnerId);

  return { status, winnerId, hasWinner };
}
