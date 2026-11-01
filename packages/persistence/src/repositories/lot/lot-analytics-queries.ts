import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { bid, lot } from "@auction/db/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import type { ArchiveEndedAggregateFilter } from "../../interfaces/index.js";
import { queryCreatedAtDailyCounts } from "../created-at-daily-count.query.js";
import { type ListWhereInput, endYearBoundsUtc, listWhere } from "./lot-list-filters.js";

export async function countMatchingLots(db: Database, filter: ListWhereInput): Promise<number> {
  const whereClause = listWhere(filter);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(lot).where(whereClause);
  return row?.n ?? 0;
}

export async function sumEndedLotHammer(
  db: Database,
  filter: ArchiveEndedAggregateFilter,
): Promise<{ total: string; count: number }> {
  const conditions = [eq(lot.status, "ended"), lotNotDeleted()];
  if (filter.endYear !== undefined) {
    const { start, end } = endYearBoundsUtc(filter.endYear);
    conditions.push(gte(lot.endTime, start));
    conditions.push(lt(lot.endTime, end));
  }
  const whereClause = and(...conditions);
  const [row] = await db
    .select({
      // Only a sold lot has a hammer price; an unsold lot's last bid is not part of the total.
      total: sql<string>`coalesce(sum(${lot.currentPrice}) filter (where ${lot.winnerId} is not null), 0)::text`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(lot)
    .where(whereClause);
  return {
    total: row?.total ?? "0",
    count: row?.cnt ?? 0,
  };
}

export async function countLotsCreatedAtByDay(
  db: Database,
  rangeStart: Date,
): Promise<Map<string, number>> {
  return queryCreatedAtDailyCounts(db, lot, lot.createdAt, rangeStart, lotNotDeleted());
}

/** Count lots that ended per UTC day (by endTime). */
export async function countLotsEndedAtByDay(
  db: Database,
  rangeStart: Date,
): Promise<Map<string, number>> {
  return queryCreatedAtDailyCounts(
    db,
    lot,
    lot.endTime,
    rangeStart,
    and(eq(lot.status, "ended"), lotNotDeleted()),
  );
}

/**
 * Lots open for bidding on each UTC day from `rangeStart` to today: their bidding window (start to
 * end) overlaps the day. Drafts, cancelled, voided and deleted lots are left out. Every day in the
 * range is present, with 0 when nothing was live.
 */
export async function countLotsLiveByDay(
  db: Database,
  rangeStart: Date,
): Promise<Map<string, number>> {
  const result = await db.execute(sql`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day_key, count(l.id)::int AS n
    FROM generate_series(
      date_trunc('day', ${rangeStart}::timestamptz AT TIME ZONE 'UTC'),
      date_trunc('day', now() AT TIME ZONE 'UTC'),
      interval '1 day'
    ) AS d(day)
    LEFT JOIN ${lot} l
      ON l.start_time < (d.day + interval '1 day') AT TIME ZONE 'UTC'
      AND l.end_time >= d.day AT TIME ZONE 'UTC'
      AND l.status IN ('scheduled', 'active', 'ended')
      AND l.deleted_at IS NULL
    GROUP BY d.day
  `);
  const rows = (
    Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])
  ) as Array<{ day_key: string; n: number | string }>;
  return new Map(rows.map((row) => [row.day_key, Number(row.n)]));
}

/** Sum hammer (current price) for lots that ended per UTC day (by endTime). */
export async function sumEndedLotHammerByDay(
  db: Database,
  rangeStart: Date,
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      dayKey: sql<string>`to_char(date_trunc('day', ${lot.endTime} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      total: sql<number>`coalesce(sum(${lot.currentPrice}) filter (where ${lot.winnerId} is not null), 0)::float8`,
    })
    .from(lot)
    .where(and(eq(lot.status, "ended"), lotNotDeleted(), gte(lot.endTime, rangeStart)))
    .groupBy(sql`date_trunc('day', ${lot.endTime} AT TIME ZONE 'UTC')`);
  return new Map(rows.map((r) => [r.dayKey, r.total ?? 0]));
}

/** Sum reserve (fallback current) prices for lots in a sale — aggregate estimate proxy. */
export async function sumSaleLotEstimates(
  db: Database,
  saleId: string,
): Promise<{ total: string; count: number }> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(coalesce(${lot.reservePrice}, ${lot.currentPrice}, 0)), 0)::text`,
      cnt: sql<number>`count(*)::int`,
    })
    .from(lot)
    .where(and(eq(lot.saleId, saleId), lotNotDeleted()));
  return { total: row?.total ?? "0", count: row?.cnt ?? 0 };
}

export type SaleBidActivityByChannel = {
  online: number;
  room: number;
  phone: number;
};

/** Count bids on sale lots grouped by placement channel. */
export async function countSaleBidActivityByChannel(
  db: Database,
  saleId: string,
): Promise<SaleBidActivityByChannel> {
  const rows = await db
    .select({
      placedVia: bid.placedVia,
      cnt: sql<number>`count(*)::int`,
    })
    .from(bid)
    .innerJoin(lot, eq(bid.lotId, lot.id))
    .where(and(eq(lot.saleId, saleId), lotNotDeleted()))
    .groupBy(bid.placedVia);

  let online = 0;
  let room = 0;
  let phone = 0;
  for (const row of rows) {
    const via = row.placedVia ?? "web";
    const n = row.cnt ?? 0;
    if (via === "saleroom") room += n;
    else if (via === "telephone" || via === "absentee") phone += n;
    else online += n;
  }
  return { online, room, phone };
}

/** Distinct bidders with bids on active lots in this sale. */
export async function countActiveBiddersForSale(db: Database, saleId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(distinct ${bid.bidderId})::int` })
    .from(bid)
    .innerJoin(lot, eq(bid.lotId, lot.id))
    .where(and(eq(lot.saleId, saleId), eq(lot.status, "active"), lotNotDeleted()));
  return row?.n ?? 0;
}
