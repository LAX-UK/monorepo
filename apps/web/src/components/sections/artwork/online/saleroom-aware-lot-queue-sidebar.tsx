"use client";

import {
  type LotQueueCardVM,
  mapSaleLotsToQueueVMs,
  mapSaleLotsToSaleroomQueueVMs,
} from "@/components/sections/artwork/artwork-view-models";
import { LotQueueSidebar } from "@/components/sections/artwork/online/lot-queue-sidebar";
import { useSaleroomLive } from "@/lib/context/saleroom-live-provider";
import type { CatalogLinkParams } from "@/lib/marketing/catalog-links";
import type { Lot } from "@auction/types";
import { useMemo } from "react";

type Props = {
  viewedLot: Lot;
  saleLots: Lot[] | null;
  catalogueQueue: {
    current: LotQueueCardVM;
    upNext: LotQueueCardVM | null;
    queue: LotQueueCardVM[];
  };
  artistNameByLotId: Record<string, string>;
  catalogLinkParams?: CatalogLinkParams;
  isSaleQueueLoading?: boolean;
  isHybridSale: boolean;
  className?: string;
};

export function SaleroomAwareLotQueueSidebar({
  viewedLot,
  saleLots,
  catalogueQueue,
  artistNameByLotId,
  catalogLinkParams,
  isSaleQueueLoading = false,
  isHybridSale,
  className,
}: Props) {
  const saleroom = useSaleroomLive();

  const queue = useMemo(() => {
    const resolveArtistName = (l: Lot) => artistNameByLotId[l.id] ?? "Artist";

    if (!isHybridSale || !saleLots?.length || !saleroom) return catalogueQueue;

    const saleroomQueue = mapSaleLotsToSaleroomQueueVMs(
      saleLots,
      saleroom.currentLotId,
      saleroom.status,
      resolveArtistName,
      catalogLinkParams,
    );

    if (saleroomQueue) {
      return {
        current: catalogueQueue.current,
        upNext: saleroomQueue.upNext,
        queue: saleroomQueue.queue,
      };
    }

    return mapSaleLotsToQueueVMs(viewedLot, saleLots, resolveArtistName, catalogLinkParams);
  }, [
    isHybridSale,
    saleLots,
    catalogueQueue,
    artistNameByLotId,
    catalogLinkParams,
    viewedLot,
    saleroom,
  ]);

  return (
    <LotQueueSidebar
      current={queue.current}
      upNext={queue.upNext}
      queue={queue.queue}
      isSaleQueueLoading={isSaleQueueLoading}
      {...(className !== undefined ? { className } : {})}
    />
  );
}
