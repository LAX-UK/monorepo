import { buildSalesListKpiTiles } from "@/lib/admin/sales/build-sales-list-kpi-tiles";
import { EMPTY_ADMIN_SALES_LIST_SUMMARY } from "@/lib/data/http/admin-sales-summary.server";
import { describe, expect, it } from "vitest";

describe("buildSalesListKpiTiles", () => {
  it("returns six dashboard KPI tiles with sparklines", () => {
    const tiles = buildSalesListKpiTiles({
      summary: {
        ...EMPTY_ADMIN_SALES_LIST_SUMMARY,
        activeCount: 3,
        upcomingCount: 2,
        draftCount: 5,
        completedCount: 10,
        lensCounts: { all: 20, upcoming: 2, live: 3, closed: 8, settled: 2, setup: 1 },
      },
      salesTrend: { currentTotal: 4, priorTotal: 2, dailyCounts: [1, 2, 3] },
      salesHammerTrend: { currentTotal: 100, priorTotal: 80, dailyCounts: [2, 3, 4] },
      periodDays: 30,
    });

    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect(tile.variant).toBe("dashboard");
      expect(tile.trend?.length).toBeGreaterThan(0);
    }
    expect(tiles[0]?.label).toBe("Active sales");
    expect(tiles[1]?.label).toBe("New sales");
  });
});
