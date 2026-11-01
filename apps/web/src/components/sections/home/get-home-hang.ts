import "server-only";

import { fetchHomeLots, fetchHomeSales } from "@/components/sections/home/home-fetchers";
import {
  type HangSale,
  type HomeHangVM,
  pickCurrentSale,
  resolveHomeHang,
} from "@/lib/hang/home-hang";
import type { SaleListRow } from "@/lib/sale-list-row";

/** Most lots read for one sale: the API's page limit, enough to find a sale's featured lots. */
const LOTS_PER_SALE = 100;
const ENDED_SALES_READ = 4;
const RECENT_SALES = 2;

async function withLots(
  row: Pick<SaleListRow, "sale" | "lotCount">,
  ended: boolean,
): Promise<HangSale> {
  const lots = await fetchHomeLots({
    saleId: row.sale.id,
    limit: LOTS_PER_SALE,
    ...(ended ? { status: "ended" as const } : {}),
  });
  return { sale: row.sale, lots, lotCount: row.lotCount };
}

/**
 * The hang under the home hero. Reads the current sale's lots when a sale is live or upcoming,
 * otherwise the last two ended sales' sold lots. Any failure leaves the section out: the rest of
 * the page does not depend on it.
 */
export async function getHomeHang(
  openSales: readonly SaleListRow[],
  now: Date = new Date(),
): Promise<HomeHangVM | null> {
  try {
    const current = pickCurrentSale(openSales);
    if (current) {
      return resolveHomeHang({ openSales: [await withLots(current, false)], endedSales: [], now });
    }
    const endedRows = await fetchHomeSales({
      status: "ended",
      sort: "createdDesc",
      limit: ENDED_SALES_READ,
    });
    const recent = [...endedRows]
      .sort((a, b) => b.sale.endTime.getTime() - a.sale.endTime.getTime())
      .slice(0, RECENT_SALES);
    const endedSales = await Promise.all(recent.map((row) => withLots(row, true)));
    return resolveHomeHang({ openSales: [], endedSales, now });
  } catch (err) {
    console.error("[getHomeHang] data load failed", err);
    return null;
  }
}
