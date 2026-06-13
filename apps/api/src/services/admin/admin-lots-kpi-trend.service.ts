import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot } from "@auction/db/schema";
import { and, gte, sql } from "drizzle-orm";

export type AdminLotsKpiTrendBundle = {
  currentTotal: number;
  priorTotal: number;
  dailyCounts: number[];
};

function utcDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function buildDayKeys(periodDays: number, anchor = new Date()): string[] {
  const end = utcDayStart(anchor);
  const keys: string[] = [];
  for (let i = periodDays - 1; i >= 0; i -= 1) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - i);
    keys.push(day.toISOString().slice(0, 10));
  }
  return keys;
}

/** Counts new lots per UTC day for the current and prior window (no list enrichment). */
export class AdminLotsKpiTrendService {
  constructor(private readonly db: Database) {}

  async getTrend(periodDays: 7 | 30 | 90): Promise<AdminLotsKpiTrendBundle> {
    const currentKeys = buildDayKeys(periodDays);
    const firstCurrentKey = currentKeys[0];
    if (!firstCurrentKey) {
      return { currentTotal: 0, priorTotal: 0, dailyCounts: [] };
    }

    const priorAnchor = utcDayStart(new Date(firstCurrentKey));
    priorAnchor.setUTCDate(priorAnchor.getUTCDate() - 1);
    const priorKeys = buildDayKeys(periodDays, priorAnchor);
    const allKeys = [...priorKeys, ...currentKeys];

    const rangeStart = utcDayStart(new Date(allKeys[0] ?? firstCurrentKey));

    const rows = await this.db
      .select({
        dayKey: sql<string>`to_char(date_trunc('day', ${lot.createdAt} AT TIME ZONE 'UTC'), 'YYYY-MM-DD')`,
        n: sql<number>`count(*)::int`,
      })
      .from(lot)
      .where(and(gte(lot.createdAt, rangeStart), lotNotDeleted()))
      .groupBy(sql`date_trunc('day', ${lot.createdAt} AT TIME ZONE 'UTC')`);

    const countsByDay = new Map(rows.map((r) => [r.dayKey, r.n ?? 0]));
    const priorDaily = priorKeys.map((k) => countsByDay.get(k) ?? 0);
    const dailyCounts = currentKeys.map((k) => countsByDay.get(k) ?? 0);

    return {
      currentTotal: dailyCounts.reduce((a, b) => a + b, 0),
      priorTotal: priorDaily.reduce((a, b) => a + b, 0),
      dailyCounts,
    };
  }
}
