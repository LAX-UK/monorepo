import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot } from "@auction/db/schema";
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
      total: sql<string>`coalesce(sum(${lot.currentPrice}), 0)::text`,
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
