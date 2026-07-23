import { buildArtistsListKpiTiles } from "@/lib/admin/artists/build-artists-list-kpi-tiles";
import { describe, expect, it } from "vitest";

describe("buildArtistsListKpiTiles", () => {
  it("returns six dashboard KPI tiles with sparklines", () => {
    const tiles = buildArtistsListKpiTiles({
      stats: {
        total: 100,
        pendingReview: 5,
        makerSellers: 12,
        historical: 40,
        brands: 8,
        featured: 3,
      },
      periodDays: 30,
    });

    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect(tile.variant).toBe("dashboard");
      expect(tile.trend?.length).toBeGreaterThan(0);
    }
  });
});
