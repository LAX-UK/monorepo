import { nextAdvanceableLotId, sortLotsForRunList } from "@auction/domain";
import type { Lot } from "@auction/types";

export { sortLotsForRunList };

export function formatLotRunListLabel(lot: Lot): string {
  const number = lot.lotNumber != null ? `Lot ${lot.lotNumber}` : "Lot —";
  const title = lot.title?.trim();
  return title ? `${number} · ${title}` : `${number} · ${lot.id.slice(0, 8)}…`;
}

export function findNextRunListLot(lots: readonly Lot[], currentLotId: string | null): Lot | null {
  const ordered = sortLotsForRunList(lots);
  const nextId = nextAdvanceableLotId(ordered, currentLotId);
  if (!nextId) return null;
  return ordered.find((lot) => lot.id === nextId) ?? null;
}
