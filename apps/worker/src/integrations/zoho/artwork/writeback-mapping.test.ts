import { WHERE_IT_IS_KEYS } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { planStockCodeUpdate, zohoStatusForPlace } from "./writeback-mapping.js";

describe("zohoStatusForPlace", () => {
  it.each([
    ["not_offered", "Available"],
    ["draft_lax_art", "Available"],
    ["lax_art", "Available"],
    ["draft_bid_lot", "Available"],
    ["bid_sale", "In Auction"],
    ["private_sale", "Reserved"],
    ["withdrawn", "Withdrawn"],
    ["sold", "Sold"],
  ] as const)("maps %s to %s", (place, status) => {
    expect(zohoStatusForPlace(place)).toBe(status);
  });

  it("covers every place", () => {
    for (const place of WHERE_IT_IS_KEYS) expect(zohoStatusForPlace(place)).toBeTruthy();
  });
});

describe("planStockCodeUpdate", () => {
  it("sends only the stock code, and only when it differs", () => {
    expect(planStockCodeUpdate("LAX-ORI-PH-GAC-26-0001", { stockCode: null })).toEqual({
      fields: { Reference_Stock_Code: "LAX-ORI-PH-GAC-26-0001" },
    });
    expect(
      planStockCodeUpdate("LAX-ORI-PH-GAC-26-0001", { stockCode: "LAX-ORI-PH-GAC-26-0001" }),
    ).toBeNull();
  });
});
