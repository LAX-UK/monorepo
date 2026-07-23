import { buildDisputesListKpiTiles } from "@/lib/admin/finance/build-disputes-list-kpi-tiles";
import { describe, expect, it } from "vitest";

describe("buildDisputesListKpiTiles", () => {
  it("builds four snapshot KPIs with semantic attention", () => {
    const tiles = buildDisputesListKpiTiles({
      open: 2,
      underReview: 1,
      won: 3,
      lost: 1,
      closed: 4,
    });

    expect(tiles).toHaveLength(4);
    expect(tiles[0]?.semanticTone).toBe("warning");
    expect(tiles[3]?.semanticTone).toBe("danger");
  });
});
