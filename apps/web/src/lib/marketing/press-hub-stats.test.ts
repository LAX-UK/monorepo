import { describe, expect, it } from "vitest";
import { computePressHubStats, formatPressHubStatsLabel } from "./press-hub-stats.js";

describe("press-hub-stats", () => {
  it("maps meta into hero stats", () => {
    expect(
      computePressHubStats({
        total: 5,
        archiveTotal: 120,
        outletCount: 40,
        lastUpdated: null,
        availableYears: [2026, 2024, 2019],
      }),
    ).toEqual({
      totalArticles: 120,
      outletCount: 40,
      oldestYear: 2019,
    });
  });

  it("formats stats label", () => {
    expect(
      formatPressHubStatsLabel({
        totalArticles: 1,
        outletCount: 1,
        oldestYear: 2018,
      }),
    ).toBe("1 article · 1 outlet · Since 2018");
  });
});
