export type KpiDeltaDirection = "up" | "down" | "flat";

export type KpiDeltaTone = "positive" | "negative" | "neutral";

export type KpiComparePeriod = "7d" | "30d" | "90d";

export type KpiWithTrend = {
  label: string;
  value: number | string;
  trend: number[];
  delta: {
    direction: KpiDeltaDirection;
    value: string;
    tone: KpiDeltaTone;
  };
  compare: KpiComparePeriod;
  compareHint: string;
};

export type BuildKpiWithTrendInput = {
  label: string;
  current: number;
  prior: number;
  dailySeries: readonly number[];
  period: KpiComparePeriod;
};

function compareHint(period: KpiComparePeriod): string {
  if (period === "7d") return "vs prior 7 days";
  if (period === "90d") return "vs prior 90 days";
  return "vs prior 30 days";
}

function formatPercent(n: number): string {
  if (!Number.isFinite(n)) return "0%";
  const rounded = Math.round(Math.abs(n) * 10) / 10;
  return `${rounded}%`;
}

/** Build KPI tile props from current/prior counts and a daily series (0–1 normalized in trend). */
export function buildKpiWithTrend(input: BuildKpiWithTrendInput): KpiWithTrend {
  const { label, current, prior, dailySeries, period } = input;
  const max = Math.max(1, ...dailySeries);
  const trend = dailySeries.map((n) => n / max);

  let direction: KpiDeltaDirection = "flat";
  let tone: KpiDeltaTone = "neutral";
  let percent = 0;

  if (prior === 0 && current > 0) {
    direction = "up";
    tone = "positive";
    percent = 100;
  } else if (prior > 0) {
    percent = ((current - prior) / prior) * 100;
    if (percent > 0.5) {
      direction = "up";
      tone = "positive";
    } else if (percent < -0.5) {
      direction = "down";
      tone = "negative";
    }
  }

  return {
    label,
    value: current,
    trend,
    delta: {
      direction,
      value: formatPercent(percent),
      tone,
    },
    compare: period,
    compareHint: compareHint(period),
  };
}

export type KpiWithTrendFields = {
  value: string;
  deltaDirection: KpiDeltaDirection;
  deltaPercent: string;
  deltaTone: KpiDeltaTone;
  trend: readonly number[];
  compareHint: string;
};

function normalizeTrendSeries(series: readonly number[]): readonly number[] {
  if (series.length === 0) return [];
  const max = Math.max(...series, 1);
  return series.map((n) => Math.max(0, n) / max);
}

/** Spec-aligned helper for {@link KpiTile} trend props from period counts + daily series. */
export function kpiWithTrend(input: {
  currentCount: number;
  priorPeriodCount: number;
  dailySeries: readonly number[];
  periodDays: number;
  formatValue?: (n: number) => string;
  higherIsBetter?: boolean;
}): KpiWithTrendFields {
  const period: KpiComparePeriod =
    input.periodDays === 7 ? "7d" : input.periodDays === 90 ? "90d" : "30d";
  const built = buildKpiWithTrend({
    label: "",
    current: input.currentCount,
    prior: input.priorPeriodCount,
    dailySeries: input.dailySeries,
    period,
  });
  const higherIsBetter = input.higherIsBetter ?? true;
  let deltaTone = built.delta.tone;
  if (!higherIsBetter && built.delta.direction === "up") deltaTone = "negative";
  if (!higherIsBetter && built.delta.direction === "down") deltaTone = "positive";

  return {
    value: (input.formatValue ?? String)(input.currentCount),
    deltaDirection: built.delta.direction,
    deltaPercent: built.delta.value,
    deltaTone,
    trend: normalizeTrendSeries(input.dailySeries),
    compareHint: built.compareHint,
  };
}
