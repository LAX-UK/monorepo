import type { LotRunProgress } from "@/lib/saleroom/lot-run-progress";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

export type ClerkLivePhase = "setup" | "betweenLots" | "selling" | "paused";

export function deriveClerkLivePhase(
  sessionStatus: PublicSaleroomSessionStatus["status"],
  progress: Pick<LotRunProgress, "betweenLots">,
  currentLotId: string | null,
): ClerkLivePhase {
  if (sessionStatus === "paused") return "paused";
  if (sessionStatus !== "live") return "setup";
  if (progress.betweenLots || currentLotId == null) return "betweenLots";
  return "selling";
}
