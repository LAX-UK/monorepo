function sumMoneySeries(series: { total: string }[]): number {
  return series.reduce((a, r) => a + (Number.parseFloat(r.total) || 0), 0);
}

function sumCountSeries(series: { count: number }[]): number {
  return series.reduce((a, r) => a + (r.count || 0), 0);
}

export type HalfWindowCompare = {
  current: number;
  previous: number;
  /** Percent change previous → current, or null if not meaningful */
  pctChange: number | null;
};

export function compareSeriesHalves<T extends { total: string }>(series: T[]): HalfWindowCompare {
  if (series.length < 2) {
    return { current: 0, previous: 0, pctChange: null };
  }
  const mid = Math.floor(series.length / 2) || 1;
  const previous = sumMoneySeries(series.slice(0, mid));
  const current = sumMoneySeries(series.slice(mid));
  const pctChange =
    previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : null;
  return { current, previous, pctChange };
}

export function compareCountSeriesHalves(series: { count: number }[]): HalfWindowCompare {
  if (series.length < 2) {
    return { current: 0, previous: 0, pctChange: null };
  }
  const mid = Math.floor(series.length / 2) || 1;
  const previous = sumCountSeries(series.slice(0, mid));
  const current = sumCountSeries(series.slice(mid));
  const pctChange =
    previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : null;
  return { current, previous, pctChange };
}

export function formatPctChange(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "— vs prior half";
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs prior half`;
}

export function pctToDeltaTone(pct: number | null): "positive" | "negative" | "neutral" {
  if (pct == null || !Number.isFinite(pct)) return "neutral";
  if (pct > 0.5) return "positive";
  if (pct < -0.5) return "negative";
  return "neutral";
}

/** Prefer API sparklines; else normalize last 7 points of a count series. */
export function sparklineForCounts(
  api: readonly number[] | undefined,
  series: { count: number }[],
): number[] {
  if (api && api.length > 0) return [...api];
  const last = series.slice(-7).map((r) => r.count);
  const max = Math.max(...last, 1);
  return last.map((n) => n / max);
}

export function sparklineForMoney(
  api: readonly number[] | undefined,
  series: { total: string }[],
): number[] {
  if (api && api.length > 0) return [...api];
  const last = series.slice(-7).map((r) => Number.parseFloat(r.total) || 0);
  const max = Math.max(...last, 1);
  return last.map((n) => n / max);
}

export function winRatePercent(ended: number, withWinner: number): string {
  if (ended <= 0) return "—";
  return `${Math.round((withWinner / ended) * 100)}%`;
}
