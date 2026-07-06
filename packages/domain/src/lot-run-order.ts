import type { Lot, LotStatus } from "@auction/types";

type LotRunPick = Pick<Lot, "id" | "status" | "lotNumber" | "title">;

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

export function sortLotsForRunList<T extends Pick<Lot, "lotNumber" | "title">>(
  lots: readonly T[],
): T[] {
  return [...lots].sort((a, b) => {
    const aNum = a.lotNumber ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.lotNumber ?? Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
}

/** Next advanceable lot id after `currentLotId` in full run order, or the first advanceable when between lots with no anchor. */
export function nextAdvanceableLotId(
  lots: readonly LotRunPick[],
  currentLotId: string | null,
): string | null {
  const orderedAll = sortLotsForRunList(lots);

  if (!currentLotId) {
    return orderedAll.find(isLotAdvanceable)?.id ?? null;
  }

  const idxInAll = orderedAll.findIndex((lot) => lot.id === currentLotId);
  if (idxInAll < 0) {
    return orderedAll.find(isLotAdvanceable)?.id ?? null;
  }

  for (let i = idxInAll + 1; i < orderedAll.length; i++) {
    const lot = orderedAll[i];
    if (lot != null && isLotAdvanceable(lot)) {
      return lot.id;
    }
  }

  return null;
}
