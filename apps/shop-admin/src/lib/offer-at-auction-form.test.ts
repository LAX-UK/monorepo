import { describe, expect, it } from "vitest";
import {
  emptyOfferAtAuctionForm,
  offerAtAuctionBody,
  saleOptionLabel,
  startingPriceText,
  validateOfferAtAuctionForm,
} from "./offer-at-auction-form";

const SALE = "33333333-3333-4333-8333-333333333333";
const valid = { saleId: SALE, priceText: "1,250.5", consignorAgreed: true };

describe("startingPriceText", () => {
  it("reads pounds as typed into two decimals", () => {
    expect(startingPriceText("250")).toBe("250.00");
    expect(startingPriceText("£1,250.5")).toBe("1250.50");
  });

  it("refuses zero, negatives, extra decimals and words", () => {
    for (const text of ["0", "0.00", "-5", "1.234", "abc", ""]) {
      expect(startingPriceText(text)).toBeNull();
    }
  });
});

describe("validateOfferAtAuctionForm", () => {
  it("asks for all three things on an empty form", () => {
    expect(validateOfferAtAuctionForm(emptyOfferAtAuctionForm())).toEqual({
      saleId: "Choose a sale",
      price: "Enter a starting price",
      consignorAgreed: "Confirm the consignor agreed",
    });
  });

  it("accepts a complete form", () => {
    expect(validateOfferAtAuctionForm(valid)).toEqual({});
  });

  it("explains a price that cannot be used", () => {
    expect(validateOfferAtAuctionForm({ ...valid, priceText: "0" }).price).toMatch(/above £0/);
  });
});

describe("offerAtAuctionBody", () => {
  it("builds the request, always with the consignor's agreement", () => {
    expect(offerAtAuctionBody(valid)).toEqual({
      saleId: SALE,
      startingPrice: "1250.50",
      consignorAgreed: true,
    });
  });

  it("builds nothing from an incomplete form", () => {
    expect(offerAtAuctionBody({ ...valid, consignorAgreed: false })).toBeNull();
    expect(offerAtAuctionBody({ ...valid, saleId: null })).toBeNull();
  });
});

describe("saleOptionLabel", () => {
  it("shows the title and the start date in UK time", () => {
    expect(saleOptionLabel("Winter sale", "2026-12-01T10:00:00.000Z")).toBe(
      "Winter sale · 1 Dec 2026",
    );
  });
});
