import { describe, expect, it } from "vitest";
import { buildVenueOverviewViewModel } from "./venue-overview.vm";

describe("buildVenueOverviewViewModel", () => {
  it("maps venue detail into KPI tiles", () => {
    const vm = buildVenueOverviewViewModel(
      {
        venue: {
          id: "ven_1",
          status: "active",
          legalEntityId: "le_1",
        },
        salesUsingCount: 4,
        legalEntityDisplayName: "Gallery Ltd",
      } as Parameters<typeof buildVenueOverviewViewModel>[0],
      30,
    );

    expect(vm.salesUsingCount).toBe(4);
    expect(vm.legalEntityDisplayName).toBe("Gallery Ltd");
    expect(vm.kpiTiles[0]?.value).toBe("4");
    expect(vm.kpiTiles[1]?.value).toBe("Active");
  });
});
