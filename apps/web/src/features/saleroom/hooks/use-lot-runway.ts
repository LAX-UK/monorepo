"use client";

import {
  findNextRunListLot,
  formatLotRunListLabel,
  sortLotsForRunList,
} from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot } from "@auction/types";
import { useMemo } from "react";

type Options = {
  lots: readonly Lot[];
  currentLotId: string | null;
  previewCount?: number;
};

export function useLotRunway({ lots, currentLotId, previewCount = 5 }: Options) {
  const orderedLots = useMemo(() => sortLotsForRunList(lots), [lots]);
  const nextLot = useMemo(
    () => findNextRunListLot(orderedLots, currentLotId),
    [orderedLots, currentLotId],
  );

  const runway = useMemo(() => {
    if (orderedLots.length === 0) return [];
    const startIndex = currentLotId
      ? Math.max(
          0,
          orderedLots.findIndex((l) => l.id === currentLotId),
        )
      : 0;
    return orderedLots.slice(startIndex, startIndex + previewCount).map((lot) => ({
      lot,
      label: formatLotRunListLabel(lot),
      isCurrent: lot.id === currentLotId,
      isNext: nextLot?.id === lot.id,
    }));
  }, [currentLotId, nextLot?.id, orderedLots, previewCount]);

  return { orderedLots, nextLot, runway };
}
