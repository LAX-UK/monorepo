import { buildCategoriesListKpiTiles } from "@/lib/admin/categories/build-categories-list-kpi-tiles";
import { describe, expect, it } from "vitest";

describe("buildCategoriesListKpiTiles", () => {
  it("returns six dashboard KPI tiles with sparklines", () => {
    const tiles = buildCategoriesListKpiTiles({
      onPageCount: 10,
      includeArchived: false,
      periodDays: 30,
      summary: {
        totalCount: 42,
        activeCount: 40,
        archivedCount: 2,
        usageTotals: { lots: 120, sales: 8, submissions: 15 },
      },
    });

    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect(tile.variant).toBe("dashboard");
      expect(tile.trend?.length).toBeGreaterThan(0);
    }
    expect(tiles[2]?.label).toBe("Linked lots");
    expect(tiles[3]?.label).toBe("Linked sales");
    expect(tiles[4]?.label).toBe("Linked submissions");
    expect(tiles[5]?.value).toBe("Active");
  });
});
