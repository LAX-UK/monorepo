import { describe, expect, it } from "vitest";
import { buildSaleAnchorTabs } from "./sale-anchor-tab-list";

describe("buildSaleAnchorTabs", () => {
  it("includes telephone tab when showTelephone is true", () => {
    expect(buildSaleAnchorTabs({ showTelephone: true })).toEqual([
      { id: "catalog", label: "Catalogue" },
      { id: "telephone", label: "Telephone bidding" },
      { id: "overview", label: "Overview" },
    ]);
  });

  it("omits telephone tab when showTelephone is false", () => {
    expect(buildSaleAnchorTabs({ showTelephone: false })).toEqual([
      { id: "catalog", label: "Catalogue" },
      { id: "overview", label: "Overview" },
    ]);
  });
});
