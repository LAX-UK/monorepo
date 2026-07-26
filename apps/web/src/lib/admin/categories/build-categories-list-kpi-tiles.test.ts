import { buildCategoriesListKpiTiles } from "@/lib/admin/categories/build-categories-list-kpi-tiles";
import { describe, expect, it } from "vitest";

describe("buildCategoriesListKpiTiles", () => {
  it("returns three Figma-aligned dashboard KPI tiles", () => {
    const tiles = buildCategoriesListKpiTiles({
      periodDays: 30,
      summary: {
        totalCount: 42,
        activeCount: 12,
        archivedCount: 2,
        usageTotals: { lots: 120, sales: 8, submissions: 15 },
        mostUsedCategory: {
          id: "c1",
          name: "Fine Art",
          slug: "fine-art",
          usage: { lots: 1284, sales: 96, submissions: 0, total: 1380 },
        },
      },
    });

    expect(tiles).toHaveLength(3);
    for (const tile of tiles) {
      expect(tile.variant).toBe("dashboard");
      expect(tile.trend?.length).toBeGreaterThan(0);
    }
    expect(tiles[0]?.label).toBe("Active categories");
    expect(tiles[0]?.value).toBe("12");
    expect(tiles[0]?.compareHint).toBe("Visible across the platform");
    expect(tiles[1]?.label).toBe("Total assignments");
    expect(tiles[1]?.value).toBe("143");
    expect(tiles[2]?.label).toBe("Most used category");
    expect(tiles[2]?.value).toBe("Fine Art");
    expect(tiles[2]?.compareHint).toBe("1284 lots · 96 sales");
  });

  it("handles empty most-used category", () => {
    const tiles = buildCategoriesListKpiTiles({
      periodDays: 30,
      summary: {
        totalCount: 0,
        activeCount: 0,
        archivedCount: 0,
        usageTotals: { lots: 0, sales: 0, submissions: 0 },
        mostUsedCategory: null,
      },
    });

    expect(tiles[2]?.value).toBe("—");
    expect(tiles[2]?.compareHint).toBe("No assignments yet");
  });
});
