import type { Lot } from "@auction/types";

export function sortLotsForRunList(lots: readonly Lot[]): Lot[] {
  return [...lots].sort((a, b) => {
    const aNum = a.lotNumber ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.lotNumber ?? Number.MAX_SAFE_INTEGER;
    if (aNum !== bNum) return aNum - bNum;
    return a.title.localeCompare(b.title);
  });
}

export function formatLotRunListLabel(lot: Lot): string {
  const number = lot.lotNumber != null ? `Lot ${lot.lotNumber}` : "Lot —";
  const title = lot.title?.trim();
  return title ? `${number} · ${title}` : `${number} · ${lot.id.slice(0, 8)}…`;
}

import { isLotAdvanceable } from "@/lib/saleroom/lot-run-progress";

export function findNextRunListLot(lots: readonly Lot[], currentLotId: string | null): Lot | null {
  const ordered = sortLotsForRunList(lots).filter(isLotAdvanceable);
  if (ordered.length === 0) return null;
  if (!currentLotId) return ordered[0] ?? null;
  const currentIndex = ordered.findIndex((lot) => lot.id === currentLotId);
  if (currentIndex < 0) return ordered[0] ?? null;
  return ordered[currentIndex + 1] ?? null;
}
