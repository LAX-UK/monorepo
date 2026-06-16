"use client";

import {
  type LotRunOutcome,
  computeLotRunProgress,
  deriveLotRunOutcome,
} from "@/lib/saleroom/lot-run-progress";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
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
  sessionStatus?: PublicSaleroomSessionStatus["status"];
};

export type LotRunwayRow = {
  lot: Lot;
  label: string;
  outcome: LotRunOutcome;
  isCurrent: boolean;
  isNext: boolean;
};

export function useLotRunway({ lots, currentLotId, sessionStatus = "none" }: Options) {
  const orderedLots = useMemo(() => sortLotsForRunList(lots), [lots]);
  const nextLot = useMemo(
    () => findNextRunListLot(orderedLots, currentLotId),
    [orderedLots, currentLotId],
  );

  const progress = useMemo(
    () => computeLotRunProgress(orderedLots, currentLotId, sessionStatus),
    [orderedLots, currentLotId, sessionStatus],
  );

  const runway = useMemo((): LotRunwayRow[] => {
    return orderedLots.map((lot) => ({
      lot,
      label: formatLotRunListLabel(lot),
      outcome: deriveLotRunOutcome(lot, currentLotId),
      isCurrent: lot.id === currentLotId,
      isNext: nextLot?.id === lot.id,
    }));
  }, [currentLotId, nextLot?.id, orderedLots]);

  return { orderedLots, nextLot, runway, progress };
}
