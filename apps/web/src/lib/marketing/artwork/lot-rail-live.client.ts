"use client";

import type { LotRelatedRailVM } from "@/components/sections/artwork/artwork-view-models";
import type {
  LiveCardFields,
  SaleCatalogueLiveRead,
} from "@/lib/marketing/saleroom/card-live-state";
import { fetchSaleCatalogueLive } from "@/lib/marketing/saleroom/sale-catalogue-live.client";
import { useQuery } from "@tanstack/react-query";

/** The catalogue page the rail's lots are read from: lots in running order, first page. */
const RAIL_LIVE_READ: SaleCatalogueLiveRead = { limit: 48, offset: 0, sort: "lot" };

/** The sales the rail's cards belong to, each once. */
function railSaleIds(rail: LotRelatedRailVM): string[] {
  return [...new Set(rail.cards.flatMap((card) => (card.saleId ? [card.saleId] : [])))];
}

/**
 * The rail's bid state (CO-7): the lot page is built from cached reads, so the rail's cards carry
 * none. On mount the browser reads each card's sale catalogue no-store, the read the sale page's
 * cards use, and maps the live fields the same way. A card the read does not return, or a failed
 * read, leaves the card's placeholders; `null` until the first read lands.
 */
export function useLotRailLive(rail: LotRelatedRailVM): ReadonlyMap<string, LiveCardFields> | null {
  const saleIds = railSaleIds(rail);
  const query = useQuery({
    queryKey: ["lot-rail-live", saleIds],
    queryFn: async () => {
      const reads = await Promise.all(
        saleIds.map((saleId) =>
          fetchSaleCatalogueLive({
            saleId,
            reads: [RAIL_LIVE_READ],
            premiumSale: rail.premiumSale,
          }),
        ),
      );
      const live = new Map<string, LiveCardFields>();
      for (const read of reads) for (const [id, fields] of read ?? []) live.set(id, fields);
      return live;
    },
    enabled: saleIds.length > 0,
    staleTime: 5_000,
  });
  return query.data ?? null;
}
