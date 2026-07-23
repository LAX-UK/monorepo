import {
  buildManualReviewKpiTiles,
  buildPaymentsListKpiTiles,
} from "@/lib/admin/finance/build-payments-list-kpi-tiles";
import { describe, expect, it } from "vitest";

describe("payment KPI builders", () => {
  it("builds the canonical payment band with trends", () => {
    const tiles = buildPaymentsListKpiTiles({
      summary: { totalVolume: 120_000, captured: 80_000, pending: 30_000, refunded: 10_000 },
      trend: { currentTotal: 12, priorTotal: 10, dailyCounts: [2, 4, 6] },
      periodDays: 30,
    });

    expect(tiles).toHaveLength(5);
    expect(tiles.map((tile) => tile.label)).toContain("Awaiting action");
    expect(tiles.every((tile) => tile.variant === "dashboard")).toBe(true);
  });

  it("uses snapshot tiles for manual review queues", () => {
    const tiles = buildManualReviewKpiTiles({
      total: 4,
      financeHolds: 3,
      complianceHolds: 1,
    });
    expect(tiles).toHaveLength(3);
    expect(tiles[1]?.semanticTone).toBe("warning");
    expect(tiles[2]?.semanticTone).toBe("danger");
  });
});
