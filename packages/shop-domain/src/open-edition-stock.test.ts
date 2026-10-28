import { describe, expect, it } from "vitest";
import { isOpenStockLow, summariseOpenStock } from "./open-edition-stock.js";

describe("summariseOpenStock", () => {
  it("counts prints by sale state and by where they are", () => {
    expect(
      summariseOpenStock([
        { listingStatus: "authorised", custodyStatus: "stored" },
        { listingStatus: "authorised", custodyStatus: "unprinted" },
        { listingStatus: "reserved", custodyStatus: "stored" },
        { listingStatus: "sold", custodyStatus: "stored" },
        { listingStatus: "not_authorised", custodyStatus: "unprinted" },
        { listingStatus: "withdrawn", custodyStatus: "stored" },
      ]),
    ).toEqual({ onSale: 2, reserved: 1, sold: 1, toPrint: 2, inStorage: 2 });
  });

  it("is empty for a run with no stock", () => {
    expect(summariseOpenStock([])).toEqual({
      onSale: 0,
      reserved: 0,
      sold: 0,
      toPrint: 0,
      inStorage: 0,
    });
  });
});

describe("isOpenStockLow", () => {
  it("warns at 3 or fewer prints on sale", () => {
    expect(isOpenStockLow({ onSale: 3 })).toBe(true);
    expect(isOpenStockLow({ onSale: 0 })).toBe(true);
    expect(isOpenStockLow({ onSale: 4 })).toBe(false);
  });
});
