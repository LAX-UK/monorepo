"use client";

import type { Lot } from "@auction/types";
import type { SaleroomRealtimePayload } from "@auction/types";
import { useEffect, useRef, useState } from "react";

type Options = {
  initialLots: Lot[];
  liveFeed?: SaleroomRealtimePayload[];
};

export type ClerkLotRosterSyncState = {
  lots: Lot[];
  /** Lot ids hammered via socket before RSC refresh supplies winnerId. */
  hammeredLotIds: ReadonlySet<string>;
};

/**
 * Keeps clerk console lot list in sync with saleroom socket events (hammer/no_sale/advance)
 * so runway outcome states update without waiting for a full RSC refetch.
 */
export function useClerkLotRosterSync({
  initialLots,
  liveFeed = [],
}: Options): ClerkLotRosterSyncState {
  const [lots, setLots] = useState<Lot[]>(initialLots);
  const [hammeredLotIds, setHammeredLotIds] = useState<ReadonlySet<string>>(() => new Set());
  const processedFeedCountRef = useRef(0);

  useEffect(() => {
    setLots(initialLots);
    setHammeredLotIds(new Set());
  }, [initialLots]);

  useEffect(() => {
    const newEvents = liveFeed.slice(0, liveFeed.length - processedFeedCountRef.current);
    processedFeedCountRef.current = liveFeed.length;
    if (newEvents.length === 0) return;

    const hammeredIds: string[] = [];
    setLots((prev) => {
      let next = prev;
      for (const event of newEvents) {
        if (!event.lotId) continue;
        switch (event.kind) {
          case "hammer":
            hammeredIds.push(event.lotId);
            next = patchLot(next, event.lotId, { status: "ended" });
            break;
          case "no_sale":
            next = patchLot(next, event.lotId, { status: "ended", winnerId: null });
            break;
          case "advanced_to_lot":
            next = patchLot(next, event.lotId, { status: "active" });
            break;
          default:
            break;
        }
      }
      return next;
    });

    if (hammeredIds.length > 0) {
      setHammeredLotIds((prev) => {
        const next = new Set(prev);
        for (const id of hammeredIds) next.add(id);
        return next;
      });
    }
  }, [liveFeed]);

  return { lots, hammeredLotIds };
}

function patchLot(
  lots: Lot[],
  lotId: string,
  patch: Partial<Pick<Lot, "status" | "winnerId">>,
): Lot[] {
  const index = lots.findIndex((l) => l.id === lotId);
  if (index < 0) return lots;
  const current = lots[index];
  if (!current) return lots;
  const updated: Lot = {
    ...current,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.winnerId !== undefined ? { winnerId: patch.winnerId } : {}),
  };
  return [...lots.slice(0, index), updated, ...lots.slice(index + 1)];
}
