import { describe, expect, it } from "vitest";
import { type SellerTermsFiguresRow, sellerTermsFigures } from "./seller-terms-figures.js";

const priced: SellerTermsFiguresRow = {
  figuresBasis: "agreement",
  figuresHammerPence: 8_200_000,
  figuresCommissionBps: 1500,
  figuresCommissionPence: 1_230_000,
  figuresVatTreatment: "standard",
  figuresVatBps: 2000,
  figuresVatPence: 246_000,
  figuresNetPence: 6_724_000,
};

describe("sellerTermsFigures", () => {
  it("reads a priced snapshot's figures as recorded", () => {
    expect(sellerTermsFigures(priced)).toEqual({
      hammerPence: 8_200_000,
      commissionBps: 1500,
      commissionPence: 1_230_000,
      vatTreatment: "standard",
      vatBps: 2000,
      vatPence: 246_000,
      netPence: 6_724_000,
    });
  });

  it("has no figures for a held or LAX-owned sale, or a line with no snapshot", () => {
    expect(sellerTermsFigures({ ...priced, figuresBasis: "held" })).toBeNull();
    expect(sellerTermsFigures({ ...priced, figuresBasis: "lax_owned" })).toBeNull();
    expect(sellerTermsFigures({ ...priced, figuresBasis: null })).toBeNull();
    expect(sellerTermsFigures({ ...priced, figuresVatTreatment: "zero" })).toBeNull();
  });
});
