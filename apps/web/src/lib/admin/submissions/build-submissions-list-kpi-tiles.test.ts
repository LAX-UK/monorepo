import { buildSubmissionsListKpiTiles } from "@/lib/admin/submissions/build-submissions-list-kpi-tiles";
import { EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY } from "@/lib/data/http/admin-submissions-summary.server";
import { describe, expect, it } from "vitest";

describe("buildSubmissionsListKpiTiles", () => {
  it("returns six dashboard KPI tiles with sparklines", () => {
    const tiles = buildSubmissionsListKpiTiles({
      summary: {
        ...EMPTY_ADMIN_SUBMISSIONS_LIST_SUMMARY,
        awaitingReview: 12,
        assignedToMe: 3,
        overSla: 2,
        qualityGaps: 5,
        reviewedToday: 4,
        rejectedToday: 1,
      },
      periodDays: 30,
      qualityGapsOnPage: 2,
    });

    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect(tile.variant).toBe("dashboard");
      expect(tile.trend?.length).toBeGreaterThan(0);
    }
  });
});
