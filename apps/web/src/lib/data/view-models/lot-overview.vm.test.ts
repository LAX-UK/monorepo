import { describe, expect, it } from "vitest";
import { buildLotOverviewViewModel } from "./lot-overview.vm";

describe("buildLotOverviewViewModel", () => {
  it("builds KPI tiles and attention for draft lot missing photos", () => {
    const vm = buildLotOverviewViewModel({
      lotId: "lot-1",
      auction: {
        id: "lot-1",
        title: "Test vase",
        status: "draft",
        images: [],
        description: "",
        startingPrice: "100",
        currentPrice: "100",
        buyerPremiumRate: "0.15",
        auctionType: "english",
        startTime: new Date("2026-01-01"),
        endTime: new Date("2026-01-02"),
        marketingDetails: {},
      } as never,
      context: { sale: null, artist: null, categories: [], seller: null, parentSaleLotCount: null },
      bidCount: 0,
      readiness: {
        items: [{ id: "images", label: "Images", ok: false, severity: "required" }],
        completeCount: 0,
        totalCount: 1,
        percent: 0,
        firstFailing: { id: "images", label: "Images", ok: false, severity: "required" },
      },
    });

    expect(vm.kpiTiles.some((t) => t.id === "current-bid")).toBe(true);
    expect(vm.attentionRows.some((r) => r.id === "readiness-images")).toBe(true);
    expect(vm.commercialRows.find((r) => r.id === "type")?.value).toBe("English");
    expect(vm.auditRows.some((r) => r.id === "updated")).toBe(true);
  });
});
