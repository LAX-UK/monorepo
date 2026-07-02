import type { LotRunProgress } from "@/lib/saleroom/lot-run-progress";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";

export type ClerkLivePhase = "setup" | "betweenLots" | "selling" | "paused" | "concluded";

export function deriveClerkLivePhase(
  sessionStatus: PublicSaleroomSessionStatus["status"],
  progress: Pick<LotRunProgress, "betweenLots">,
  currentLotId: string | null,
  allLotsDone = false,
): ClerkLivePhase {
  const sessionOpen = sessionStatus === "live" || sessionStatus === "paused";
  if (!sessionOpen) return "setup";
  if (allLotsDone) return "concluded";
  if (sessionStatus === "paused") return "paused";
  if (progress.betweenLots || currentLotId == null) return "betweenLots";
  return "selling";
}
