import { OFFER_STATES } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { planStatusUpdate, planStockCodeUpdate, zohoStatusForOffer } from "./writeback-mapping.js";

describe("zohoStatusForOffer", () => {
  it.each([
    ["held", "Available"],
    ["lax_art", "Available"],
    ["bid_sale", "In Auction"],
    ["private_sale", "Reserved"],
    ["sold", "Sold"],
    ["withdrawn", "Withdrawn"],
  ] as const)("maps %s to %s", (state, status) => {
    expect(zohoStatusForOffer(state)).toBe(status);
  });

  it("covers every offer state", () => {
    for (const state of OFFER_STATES) expect(zohoStatusForOffer(state)).toBeTruthy();
  });
});

describe("planStatusUpdate", () => {
  it("sends only the Status, and only when Zoho holds a different one", () => {
    expect(planStatusUpdate("bid_sale", { status: "Available", stockCode: "X" })).toEqual({
      fields: { Status: "In Auction" },
    });
    expect(planStatusUpdate("bid_sale", { status: null, stockCode: null })).toEqual({
      fields: { Status: "In Auction" },
    });
  });

  it("sends nothing when Zoho already holds the value", () => {
    expect(planStatusUpdate("sold", { status: "Sold", stockCode: null })).toBeNull();
  });
});

describe("planStockCodeUpdate", () => {
  it("sends only the stock code, and only when it differs", () => {
    expect(
      planStockCodeUpdate("LAX-ORI-PH-GAC-26-0001", { status: "Sold", stockCode: null }),
    ).toEqual({
      fields: { Reference_Stock_Code: "LAX-ORI-PH-GAC-26-0001" },
    });
    expect(
      planStockCodeUpdate("LAX-ORI-PH-GAC-26-0001", {
        status: null,
        stockCode: "LAX-ORI-PH-GAC-26-0001",
      }),
    ).toBeNull();
  });
});
