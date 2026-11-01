import "server-only";

import { fetchHomeLots } from "@/components/sections/home/home-fetchers";
import type { HangSale } from "@/lib/hang/home-hang";
import type { SaleListRow } from "@/lib/sale-list-row";

/** Most lots read for one sale: the API's page limit, enough to find a sale's featured lots. */
const LOTS_PER_SALE = 100;

/**
 * Reads the lots of the sales the hang needs (chosen from the home state). A sale that cannot be
 * read is skipped, so a failure leaves the section out and the rest of the page unaffected.
 */
export async function getHomeHangSales(
  saleIds: readonly string[],
  rows: readonly Pick<SaleListRow, "sale" | "lotCount">[],
): Promise<HangSale[]> {
  const wanted = saleIds.flatMap((id) => rows.find((row) => row.sale.id === id) ?? []);
  const loaded = await Promise.all(
    wanted.map(async (row): Promise<HangSale | null> => {
      try {
        const lots = await fetchHomeLots({
          saleId: row.sale.id,
          limit: LOTS_PER_SALE,
          ...(row.sale.status === "ended" ? { status: "ended" as const } : {}),
        });
        return { sale: row.sale, lots, lotCount: row.lotCount };
      } catch (err) {
        console.error("[getHomeHangSales] lots load failed", err);
        return null;
      }
    }),
  );
  return loaded.filter((entry): entry is HangSale => entry !== null);
}
