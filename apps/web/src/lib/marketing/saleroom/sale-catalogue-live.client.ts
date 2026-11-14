"use client";

import { browserApiBase, browserFetch } from "@/lib/data/http/hc-browser";
import {
  type LiveCardFields,
  type SaleCatalogueLiveRead,
  liveCardFields,
} from "@/lib/marketing/saleroom/card-live-state";
import type { Sale } from "@auction/types";
import { useQuery } from "@tanstack/react-query";

/** How often the cards read their prices and states again while the page is open. */
export const SALE_CATALOGUE_LIVE_REFRESH_MS = 60_000;

export type SaleCatalogueLiveInput = {
  saleId: string;
  reads: SaleCatalogueLiveRead[];
  /** The sale's premium, so a sold lot reads the buyer's price, as the server would draw it. */
  premiumSale: Pick<Sale, "buyerPremiumRate" | "buyerPremiumTiers">;
};

/**
 * Reads the catalogue pages behind the cards again, no-store, and maps each lot's live fields
 * the way the server maps a card. The schema and the mapper load with the read, so they are not
 * in the page's first scripts. `null` when any read fails: the cards keep their placeholders.
 */
export async function fetchSaleCatalogueLive(
  input: SaleCatalogueLiveInput,
): Promise<Map<string, LiveCardFields> | null> {
  try {
    const [{ saleLotsPageDataSchema }, { readDataEnvelope }, { mapLotToCardVM }] =
      await Promise.all([
        import("@/lib/data/http/sales.schema"),
        import("@/lib/data/http/envelope"),
        import("@/lib/marketing/saleroom/mappers"),
      ]);
    const pages = await Promise.all(
      input.reads.map(async (read) => {
        const qs = new URLSearchParams({
          limit: String(read.limit),
          offset: String(read.offset),
          sort: read.sort,
        });
        const path = `/sales/${encodeURIComponent(input.saleId)}/lots?${qs.toString()}`;
        // Never answered from a cache: this read is what corrects the cached page.
        const res = await browserFetch(`${browserApiBase()}${path}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`live catalogue read failed: ${res.status}`);
        return readDataEnvelope(await res.json(), saleLotsPageDataSchema, `GET ${path}`);
      }),
    );
    const now = new Date();
    const live = new Map<string, LiveCardFields>();
    for (const page of pages) {
      for (const lot of page.items) {
        const card = mapLotToCardVM(lot, {
          viewerUserId: null,
          now,
          premiumSale: input.premiumSale,
        });
        live.set(lot.id, liveCardFields(card));
      }
    }
    return live;
  } catch {
    return null;
  }
}

/** The cards' live fields, read on mount and again every minute while the page is visible. */
export function useSaleCatalogueLive(
  input: SaleCatalogueLiveInput | null,
): ReadonlyMap<string, LiveCardFields> | null {
  const query = useQuery({
    queryKey: ["sale-catalogue-live", input?.saleId ?? null, input?.reads ?? []],
    queryFn: () => (input ? fetchSaleCatalogueLive(input) : Promise.resolve(null)),
    enabled: input !== null && input.reads.length > 0,
    refetchInterval: SALE_CATALOGUE_LIVE_REFRESH_MS,
    // The last reading holds the place while the next one is in flight.
    placeholderData: (previous) => previous,
    staleTime: 5_000,
  });
  return query.data ?? null;
}
