import type { Database } from "@auction/db";
import { type SQL, and, gte, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/** Shared SQL GROUP BY day for admin KPI trend endpoints. */
export async function queryCreatedAtDailyCounts(
  db: Database,
  table: PgTable,
  createdAtColumn: PgColumn,
  rangeStart: Date,
  extraWhere?: SQL,
): Promise<Map<string, number>> {
  const where = extraWhere
    ? and(gte(createdAtColumn, rangeStart), extraWhere)
    : gte(createdAtColumn, rangeStart);
  const rows = await db
    .select({
      dayKey: sql<string>`to_char(date_trunc('day', ${createdAtColumn} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
      n: sql<number>`count(*)::int`,
    })
    .from(table)
    .where(where)
    .groupBy(sql`date_trunc('day', ${createdAtColumn} AT TIME ZONE 'UTC')`);
  return new Map(rows.map((r) => [r.dayKey, r.n ?? 0]));
}
