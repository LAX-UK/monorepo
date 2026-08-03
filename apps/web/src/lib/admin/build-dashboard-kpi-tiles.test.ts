import { buildDashboardKpiTiles } from "@/lib/admin/build-dashboard-kpi-tiles";
import { describe, expect, it } from "vitest";

const metrics = {
  liveLots: 2,
  endingWithinHour: 1,
  draftLots: 0,
  pendingSubmissions: 0,
  stalePendingPayments: 0,
  revenueToday: "100",
};

const trends = {
  lots: { currentTotal: 1, priorTotal: 0, dailyCounts: [1] },
  submissions: { currentTotal: 0, priorTotal: 0, dailyCounts: [0] },
  payments: { currentTotal: 0, priorTotal: 0, dailyCounts: [0] },
};

describe("buildDashboardKpiTiles", () => {
  it("returns fallback operational tiles when role KPIs are unavailable", () => {
    const tiles = buildDashboardKpiTiles({
      periodDays: 7,
      metrics,
      trends,
      bidsPerMinute: 3,
    });
    expect(tiles.length).toBeGreaterThanOrEqual(4);
    expect(tiles.map((tile) => tile.id)).toContain("live-lots");
  });
});
