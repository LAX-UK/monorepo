import type { AdminKpiPeriodDays, AdminKpiTrendBundle } from "../interfaces/admin-kpi-trend.js";

function trendAnchorDate(): Date {
  const raw = process.env.ADMIN_KPI_TREND_ANCHOR?.trim();
  if (!raw) return new Date();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function utcDayStart(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

export function buildDayKeys(periodDays: number, anchor = trendAnchorDate()): string[] {
  const end = utcDayStart(anchor);
  const keys: string[] = [];
  for (let i = periodDays - 1; i >= 0; i -= 1) {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - i);
    keys.push(day.toISOString().slice(0, 10));
  }
  return keys;
}

export function buildTrendWindows(
  periodDays: AdminKpiPeriodDays,
  anchor = trendAnchorDate(),
): {
  currentKeys: string[];
  priorKeys: string[];
  rangeStart: Date;
} {
  const currentKeys = buildDayKeys(periodDays, anchor);
  const firstCurrentKey = currentKeys[0];
  if (!firstCurrentKey) {
    return { currentKeys: [], priorKeys: [], rangeStart: utcDayStart(anchor) };
  }

  const priorAnchor = utcDayStart(new Date(firstCurrentKey));
  priorAnchor.setUTCDate(priorAnchor.getUTCDate() - 1);
  const priorKeys = buildDayKeys(periodDays, priorAnchor);
  const rangeStart = utcDayStart(new Date(priorKeys[0] ?? firstCurrentKey));

  return { currentKeys, priorKeys, rangeStart };
}

export function bundleFromDailyCounts(
  countsByDay: ReadonlyMap<string, number>,
  currentKeys: readonly string[],
  priorKeys: readonly string[],
): AdminKpiTrendBundle {
  const dailyCounts = currentKeys.map((k) => countsByDay.get(k) ?? 0);
  const priorDaily = priorKeys.map((k) => countsByDay.get(k) ?? 0);
  return {
    currentTotal: dailyCounts.reduce((a, b) => a + b, 0),
    priorTotal: priorDaily.reduce((a, b) => a + b, 0),
    dailyCounts,
  };
}
