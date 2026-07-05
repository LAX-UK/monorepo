import type { Lot } from "@auction/types";

export function lotNumberTakenInSale(
  lots: Lot[],
  lotNumber: number,
  excludeLotId: string,
): boolean {
  return lots.some((l) => l.id !== excludeLotId && l.lotNumber === lotNumber);
}

export function nextLotNumberInSale(lots: Lot[], excludeLotId: string): number {
  const maxNum = lots
    .filter((l) => l.id !== excludeLotId)
    .reduce((m, l) => Math.max(m, l.lotNumber ?? 0), 0);
  return maxNum + 1;
}
