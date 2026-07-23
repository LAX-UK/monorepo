import { buildLotsListKpiTiles } from "@/lib/admin/lots/build-lots-list-kpi-tiles";
import { EMPTY_ADMIN_LOTS_LIST_SUMMARY } from "@/lib/data/http/admin-lots-summary.server";
import { describe, expect, it } from "vitest";

describe("buildLotsListKpiTiles", () => {
  it("returns six dashboard KPI tiles with sparklines", () => {
    const tiles = buildLotsListKpiTiles({
      summary: {
        ...EMPTY_ADMIN_LOTS_LIST_SUMMARY,
        lensCounts: { all: 30, live: 3, draft: 12, ending: 2, attention: 1 },
        liveCount: 3,
        draftCount: 12,
        publishedCount: 4,
        endedCount: 123,
        endingSoonCount: 2,
        needsAttentionCount: 1,
      },
      lotsTrend: { currentTotal: 5, priorTotal: 2, dailyCounts: [1, 2, 3] },
      lotsEndedTrend: { currentTotal: 10, priorTotal: 8, dailyCounts: [2, 3, 4] },
      periodDays: 30,
    });

    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect(tile.variant).toBe("dashboard");
      expect(tile.trend?.length).toBeGreaterThan(0);
    }
    expect(tiles[0]?.label).toBe("Total lots");
    expect(tiles[1]?.label).toBe("New lots");
  });
});
