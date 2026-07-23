import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { bid, lot, saleRegistration } from "@auction/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import type { SaleBidVolumeByDayAndLotRow } from "../../interfaces/sale-overview-kpi-trend.reader.js";
import { queryCreatedAtDailyCounts } from "../created-at-daily-count.query.js";

export type { SaleBidVolumeByDayAndLotRow };

export async function countSaleLotsAddedByDay(
  db: Database,
  saleId: string,
  rangeStart: Date,
): Promise<Map<string, number>> {
  return queryCreatedAtDailyCounts(
    db,
    lot,
    lot.createdAt,
    rangeStart,
    and(eq(lot.saleId, saleId), lotNotDeleted()),
  );
}

export async function sumSaleEstimateAddedByDayPence(
  db: Database,
  saleId: string,
  rangeStart: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      dayKey: sql<string>`to_char(date_trunc('day', ${lot.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      totalPence: sql<number>`coalesce(sum(round(coalesce(${lot.reservePrice}, ${lot.currentPrice}, 0)::numeric * 100)), 0)::bigint`,
    })
    .from(lot)
    .where(and(eq(lot.saleId, saleId), lotNotDeleted(), gte(lot.createdAt, rangeStart)))
    .groupBy(sql`date_trunc('day', ${lot.createdAt} AT TIME ZONE 'UTC')`);
  return new Map(rows.map((r) => [r.dayKey, Number(r.totalPence ?? 0)]));
}

export async function sumSaleBidAmountByDayPence(
  db: Database,
  saleId: string,
  rangeStart: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      dayKey: sql<string>`to_char(date_trunc('day', ${bid.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      totalPence: sql<number>`coalesce(sum(round(${bid.amount}::numeric * 100)), 0)::bigint`,
    })
    .from(bid)
    .innerJoin(lot, eq(bid.lotId, lot.id))
    .where(and(eq(lot.saleId, saleId), lotNotDeleted(), gte(bid.createdAt, rangeStart)))
    .groupBy(sql`date_trunc('day', ${bid.createdAt} AT TIME ZONE 'UTC')`);
  return new Map(rows.map((r) => [r.dayKey, Number(r.totalPence ?? 0)]));
}

export async function countSaleRegistrationsByDay(
  db: Database,
  saleId: string,
  rangeStart: Date,
): Promise<Map<string, number>> {
  return queryCreatedAtDailyCounts(
    db,
    saleRegistration,
    saleRegistration.requestedAt,
    rangeStart,
    eq(saleRegistration.saleId, saleId),
  );
}

export async function countSaleDistinctBiddersByDay(
  db: Database,
  saleId: string,
  rangeStart: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      dayKey: sql<string>`to_char(date_trunc('day', ${bid.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      n: sql<number>`count(distinct ${bid.bidderId})::int`,
    })
    .from(bid)
    .innerJoin(lot, eq(bid.lotId, lot.id))
    .where(and(eq(lot.saleId, saleId), lotNotDeleted(), gte(bid.createdAt, rangeStart)))
    .groupBy(sql`date_trunc('day', ${bid.createdAt} AT TIME ZONE 'UTC')`);
  return new Map(rows.map((r) => [r.dayKey, r.n ?? 0]));
}

export async function sumSaleBidAmountByDayAndLot(
  db: Database,
  saleId: string,
  rangeStart: Date,
): Promise<SaleBidVolumeByDayAndLotRow[]> {
  const rows = await db
    .select({
      dayKey: sql<string>`to_char(date_trunc('day', ${bid.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      lotId: lot.id,
      amountPence: sql<number>`coalesce(sum(round(${bid.amount}::numeric * 100)), 0)::bigint`,
      lotBuyerPremiumRate: lot.buyerPremiumRate,
    })
    .from(bid)
    .innerJoin(lot, eq(bid.lotId, lot.id))
    .where(and(eq(lot.saleId, saleId), lotNotDeleted(), gte(bid.createdAt, rangeStart)))
    .groupBy(
      sql`date_trunc('day', ${bid.createdAt} AT TIME ZONE 'UTC')`,
      lot.id,
      lot.buyerPremiumRate,
    );
  return rows.map((r) => ({
    dayKey: r.dayKey,
    lotId: r.lotId,
    amountPence: Number(r.amountPence ?? 0),
    lotBuyerPremiumRate: r.lotBuyerPremiumRate,
  }));
}

/** Sum current_price for all non-deleted lots in a sale (hammer snapshot). */
export async function sumSaleLotHammerPence(
  db: Database,
  saleId: string,
): Promise<{ totalPence: number; count: number }> {
  const [row] = await db
    .select({
      totalPence: sql<number>`coalesce(sum(round(coalesce(${lot.currentPrice}, 0)::numeric * 100)), 0)::bigint`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(lot)
    .where(and(eq(lot.saleId, saleId), lotNotDeleted()));
  return {
    totalPence: Number(row?.totalPence ?? 0),
    count: row?.cnt ?? 0,
  };
}

export type SaleLotRevenuePriceRow = {
  currentPrice: string;
  buyerPremiumRate: string | null;
};

export async function listSaleLotRevenuePrices(
  db: Database,
  saleId: string,
): Promise<SaleLotRevenuePriceRow[]> {
  const rows = await db
    .select({
      currentPrice: lot.currentPrice,
      buyerPremiumRate: lot.buyerPremiumRate,
    })
    .from(lot)
    .where(and(eq(lot.saleId, saleId), lotNotDeleted()));
  return rows.map((r) => ({
    currentPrice: r.currentPrice ?? "0",
    buyerPremiumRate: r.buyerPremiumRate,
  }));
}
