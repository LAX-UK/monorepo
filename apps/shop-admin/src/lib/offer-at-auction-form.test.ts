import { pinClock } from "@/test/pin-clock";
import { describe, expect, it } from "vitest";
import {
  emptyOfferAtAuctionForm,
  offerAtAuctionBody,
  offerAtAuctionErrorSummary,
  saleOptionLabel,
  startingPricePence,
  startingPriceText,
  validateOfferAtAuctionForm,
} from "./offer-at-auction-form";

const SALE = "33333333-3333-4333-8333-333333333333";
const valid = { saleId: SALE, priceText: "1,250.5", consignorAgreed: true };

pinClock();

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

const CHECKBOX = { needsCheckbox: true };
const AGREEMENT = { needsCheckbox: false };

describe("validateOfferAtAuctionForm", () => {
  it("asks for all three things on an empty form while the checkbox is the fallback", () => {
    expect(validateOfferAtAuctionForm(emptyOfferAtAuctionForm(), CHECKBOX)).toEqual({
      saleId: "Choose a sale",
      price: "Enter a starting price",
      consignorAgreed: "Confirm the consignor agreed",
    });
  });

  it("does not ask for the checkbox when an agreement decides", () => {
    expect(validateOfferAtAuctionForm(emptyOfferAtAuctionForm(), AGREEMENT)).toEqual({
      saleId: "Choose a sale",
      price: "Enter a starting price",
    });
  });

  it("accepts a complete form", () => {
    expect(validateOfferAtAuctionForm(valid, CHECKBOX)).toEqual({});
  });

  it("explains a price that cannot be used", () => {
    expect(validateOfferAtAuctionForm({ ...valid, priceText: "0" }, CHECKBOX).price).toMatch(
      /above £0/,
    );
  });
});

describe("offerAtAuctionErrorSummary", () => {
  it("lists two or more problems, linked to their fields", () => {
    expect(
      offerAtAuctionErrorSummary(validateOfferAtAuctionForm(emptyOfferAtAuctionForm(), AGREEMENT)),
    ).toEqual([
      { fieldId: "offer-sale", message: "Choose a sale" },
      { fieldId: "offer-price", message: "Enter a starting price" },
    ]);
  });

  it("leaves a single problem to its field", () => {
    expect(offerAtAuctionErrorSummary({ price: "Enter a starting price" })).toEqual([]);
  });
});

describe("offerAtAuctionBody", () => {
  it("sends the checkbox while it is the fallback", () => {
    expect(offerAtAuctionBody(valid, CHECKBOX)).toEqual({
      saleId: SALE,
      startingPrice: "1250.50",
      consignorAgreed: true,
    });
  });

  it("leaves the checkbox out when an agreement decides", () => {
    expect(offerAtAuctionBody({ ...valid, consignorAgreed: false }, AGREEMENT)).toEqual({
      saleId: SALE,
      startingPrice: "1250.50",
    });
  });

  it("builds nothing from an incomplete form", () => {
    expect(offerAtAuctionBody({ ...valid, consignorAgreed: false }, CHECKBOX)).toBeNull();
    expect(offerAtAuctionBody({ ...valid, saleId: null }, AGREEMENT)).toBeNull();
  });
});

describe("startingPricePence", () => {
  it("reads the typed price in pence", () => {
    expect(startingPricePence("1,250.5")).toBe(125_050);
    expect(startingPricePence("free")).toBeNull();
  });
});

describe("saleOptionLabel", () => {
  it("shows the title and the start date in UK time", () => {
    expect(saleOptionLabel("Winter sale", "2026-12-01T10:00:00.000Z")).toBe(
      "Winter sale · Tue 1 Dec",
    );
  });
});
