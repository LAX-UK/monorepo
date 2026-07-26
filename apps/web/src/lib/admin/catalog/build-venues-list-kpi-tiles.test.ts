import { buildVenuesListKpiTiles } from "@/lib/admin/catalog/build-venues-list-kpi-tiles";
import { describe, expect, it } from "vitest";

describe("buildVenuesListKpiTiles", () => {
  it("returns two snapshot tiles", () => {
    const tiles = buildVenuesListKpiTiles({
      countOnPage: 5,
      total: 12,
      includeArchived: false,
    });
    expect(tiles).toHaveLength(2);
    expect(tiles[0]?.label).toBe("On this page");
    expect(tiles[0]?.value).toBe("5");
    expect(tiles[1]?.label).toBe("Matching venues");
    expect(tiles[1]?.value).toBe("12");
  });
});
