import { describe, expect, it } from "vitest";
import { type AdminLotFormValues, formValuesToImageAltsPatch } from "./admin-lot-form";

const base: AdminLotFormValues = {
  title: "Lot",
  description: "",
  medium: "",
  dimensions: "",
  sellerId: "seller_1",
  categoryId: "7f3ed11b-257a-4fc1-a916-4723c8417c5e",
  auctionType: "english",
  startingPrice: "1.00",
  reservePrice: "",
  buyNowPrice: "",
  buyerPremiumRate: "",
  minBidIncrement: "",
  dutchDecrementAmount: "",
  dutchDecrementIntervalMs: "60000",
  images: [],
  imageAlts: [],
  startTime: "2026-05-05T10:00",
  endTime: "2026-05-06T10:00",
};

describe("formValuesToImageAltsPatch", () => {
  it("trims alts and preserves image order", () => {
    expect(
      formValuesToImageAltsPatch({
        ...base,
        images: ["lot/a.jpg", "lot/b.jpg"],
        imageAlts: [" Front view ", "Back view"],
      }),
    ).toEqual({ imageAlts: ["Front view", "Back view"] });
  });

  it("returns null when all alts are blank", () => {
    expect(
      formValuesToImageAltsPatch({
        ...base,
        images: ["lot/a.jpg"],
        imageAlts: ["   "],
      }),
    ).toEqual({ imageAlts: null });
  });
});
