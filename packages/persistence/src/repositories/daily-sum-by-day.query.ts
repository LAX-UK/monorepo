import type { Database } from "@auction/db";
import { type SQL, and, gte, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/** Sum a numeric column grouped by UTC calendar day; values returned as integer minor units (pence). */
export async function queryDailySumByDayPence(
  db: Database,
  table: PgTable,
  timestampColumn: PgColumn,
  amountColumn: PgColumn,
  rangeStart: Date,
  extraWhere?: SQL,
): Promise<Map<string, number>> {
  const where = extraWhere
    ? and(gte(timestampColumn, rangeStart), extraWhere)
    : gte(timestampColumn, rangeStart);
  const rows = await db
    .select({
      dayKey: sql<string>`to_char(date_trunc('day', ${timestampColumn} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      totalPence: sql<number>`coalesce(sum(round(${amountColumn}::numeric * 100)), 0)::bigint`,
    })
    .from(table)
    .where(where)
    .groupBy(sql`date_trunc('day', ${timestampColumn} AT TIME ZONE 'UTC')`);
  return new Map(rows.map((r) => [r.dayKey, Number(r.totalPence ?? 0)]));
}
