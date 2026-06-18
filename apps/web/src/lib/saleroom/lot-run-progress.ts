import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { sortLotsForRunList } from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot, LotStatus } from "@auction/types";

export type LotRunOutcome = "upcoming" | "on_block" | "sold" | "no_sale" | "skipped";

type LotRunPick = Pick<Lot, "id" | "status" | "winnerId" | "lotNumber" | "title" | "currentPrice">;

export function isLotRunSkipped(status: LotStatus): boolean {
  return status === "cancelled" || status === "voided";
}

export function isLotRunCompleted(status: LotStatus): boolean {
  return status === "ended";
}

/** Lots clerks can still advance onto the block. */
export function isLotAdvanceable(lot: Pick<Lot, "status">): boolean {
  if (isLotRunSkipped(lot.status) || isLotRunCompleted(lot.status)) return false;
  return lot.status === "active" || lot.status === "scheduled";
}

export function deriveLotRunOutcome(
  lot: LotRunPick,
  currentLotId: string | null,
  hammeredLotIds?: ReadonlySet<string>,
): LotRunOutcome {
  if (lot.id === currentLotId) return "on_block";
  if (lot.status === "ended") {
    if (lot.winnerId || hammeredLotIds?.has(lot.id)) return "sold";
    return "no_sale";
  }
  if (isLotRunSkipped(lot.status)) return "skipped";
  return "upcoming";
}

export type LotRunProgress = {
  totalLots: number;
  completedLots: number;
  remainingLots: number;
  /** 0-based index in run order when a lot is on block; null when between lots or unknown. */
  currentIndex: number | null;
  betweenLots: boolean;
  progressLabel: string;
  sessionStatusLabel: string | null;
};

export function computeLotRunProgress(
  lots: readonly Lot[],
  currentLotId: string | null,
  sessionStatus: PublicSaleroomSessionStatus["status"] = "none",
): LotRunProgress {
  const orderedLots = sortLotsForRunList(lots);
  const totalLots = orderedLots.length;
  const completedLots = orderedLots.filter((l) => isLotRunCompleted(l.status)).length;
  const remainingLots = totalLots - completedLots;

  const currentIndex =
    currentLotId != null ? orderedLots.findIndex((l) => l.id === currentLotId) : null;
  const validIndex = currentIndex != null && currentIndex >= 0 ? currentIndex : null;
  const betweenLots = sessionStatus === "live" && currentLotId == null && totalLots > 0;

  let progressLabel: string;
  if (totalLots === 0) {
    progressLabel = "No lots";
  } else if (validIndex != null) {
    progressLabel = `Lot ${validIndex + 1} of ${totalLots}`;
  } else if (betweenLots) {
    progressLabel = "Between lots — advance next";
  } else if (sessionStatus === "paused") {
    progressLabel = `${completedLots} of ${totalLots} lots complete`;
  } else {
    progressLabel = `${totalLots} lots`;
  }

  let sessionStatusLabel: string | null = null;
  if (sessionStatus === "paused") {
    sessionStatusLabel = "Paused";
  } else if (sessionStatus === "live" && betweenLots) {
    sessionStatusLabel = "Between lots";
  } else if (sessionStatus === "none" || sessionStatus === "ended" || sessionStatus === "pending") {
    sessionStatusLabel = sessionStatus === "ended" ? "Session ended" : "Not live";
  }

  return {
    totalLots,
    completedLots,
    remainingLots,
    currentIndex: validIndex,
    betweenLots,
    progressLabel,
    sessionStatusLabel,
  };
}
