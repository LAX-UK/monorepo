import { describe, expect, it } from "vitest";
import { mapDetailBoardKpiTiles } from "./map-kpi-tiles";

describe("mapDetailBoardKpiTiles", () => {
  it("passes sparkline trend and tone to KpiRow tiles", () => {
    const tiles = mapDetailBoardKpiTiles([
      {
        id: "lots",
        label: "Lots",
        value: "5",
        trend: [0.2, 0.4, 0.6, 0.8, 1],
        trendTone: "lot-orange",
        deltaPercent: "12%",
        deltaDirection: "up",
        compareHint: "vs prior 30 days",
      },
    ]);

    expect(tiles[0]).toMatchObject({
      id: "lots",
      trend: [0.2, 0.4, 0.6, 0.8, 1],
      trendTone: "lot-orange",
      deltaPercent: "12%",
      deltaDirection: "up",
    });
  });

  it("defaults sparkline tone to info", () => {
    const tiles = mapDetailBoardKpiTiles([
      {
        id: "lots",
        label: "Lots",
        value: "5",
        trend: [0.2, 0.5, 1],
      },
    ]);

    expect(tiles[0]?.trendTone).toBe("info");
  });
});
