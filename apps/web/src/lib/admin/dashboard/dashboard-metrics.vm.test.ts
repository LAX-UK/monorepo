import { describe, expect, it } from "vitest";
import { dashboardMetrics, dashboardMetricsPeriod } from "./dashboard-metrics.vm";
import { buildRoleKpiTiles } from "./role-kpis.slice";

const metrics = {
  liveLots: 12,
  endingWithinHour: 2,
  draftLots: 4,
  pendingSubmissions: 3,
  stalePendingPayments: 2,
  revenueToday: "18500.5",
};
const series = (values: number[]) => ({
  currentTotal: values.reduce((sum, value) => sum + value, 0),
  priorTotal: 4,
  dailyCounts: values,
});
const trends = {
  lots: series([1, 2, 3]),
  submissions: series([0, 1, 1]),
  payments: series([2, 2, 2]),
};

function tiles(kpiIds: Parameters<typeof buildRoleKpiTiles>[0]["kpiIds"]) {
  return buildRoleKpiTiles({
    periodDays: 30,
    metrics,
    trends,
    bidsPerMinute: 7,
    kpiIds,
    submissionsAvailable: true,
    paymentsAvailable: true,
  });
}

describe("dashboardMetrics", () => {
  it("gives period counts their daily trend and change", () => {
    const [newLots] = dashboardMetrics({
      periodDays: 30,
      tiles: tiles(["new-lots"]),
      metrics,
      trends,
      bidsPerMinute: 7,
    });
    expect(newLots).toMatchObject({
      label: "New lots",
      value: "6",
      trend: [1, 2, 3],
      comparison: { direction: "up", tone: "positive", text: "50%" },
      href: "/admin/lots",
    });
  });

  it("tones waiting work as attention and money in full", () => {
    const result = dashboardMetrics({
      periodDays: 30,
      tiles: tiles(["stale-payments", "revenue-today", "live-lots", "bids-per-minute"]),
      metrics,
      trends,
      bidsPerMinute: 7,
    });
    expect(result.map((metric) => [metric.label, metric.value, metric.tone])).toEqual([
      ["Payments pending over 48 hours", "2", "attention"],
      ["Captured today", "£18,500.50", undefined],
      ["Live lots", "12", "positive"],
      ["Bids per minute", "7", undefined],
    ]);
  });

  it("shows at most four numbers and leaves out what the role cannot see", () => {
    const result = dashboardMetrics({
      periodDays: 30,
      tiles: buildRoleKpiTiles({
        periodDays: 30,
        metrics,
        trends,
        bidsPerMinute: 7,
        kpiIds: ["live-lots", "new-lots", "payments", "submissions", "bids-per-minute"],
        submissionsAvailable: false,
        paymentsAvailable: true,
      }),
      metrics,
      trends,
      bidsPerMinute: 7,
    });
    expect(result.map((metric) => metric.id)).toEqual([
      "live-lots",
      "new-lots",
      "payments",
      "bids-per-minute",
    ]);
  });

  it("states the period the trends cover", () => {
    expect(dashboardMetricsPeriod(7)).toBe("Now, with trends over the last 7 days");
  });
});
