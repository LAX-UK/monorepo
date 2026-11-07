import { dealRecord } from "@/components/admin/private-sales/deal.fixture";
import { describe, expect, it } from "vitest";
import {
  bpsToRate,
  changedTerms,
  initialTermsDraft,
  rateToBps,
  validateTerms,
} from "./private-sale-forms";

describe("rates and basis points", () => {
  it.each([
    [0, "0"],
    [250, "0.025"],
    [1500, "0.15"],
    [10_000, "1"],
  ])("%i bps is %s", (bps, rate) => {
    expect(bpsToRate(bps)).toBe(rate);
    expect(rateToBps(rate)).toBe(bps);
  });

  it.each(["", "abc", "-1", "1.5", "0.15.2"])("does not take %j as a rate", (rate) => {
    expect(rateToBps(rate)).toBeNull();
  });
});

describe("changedTerms", () => {
  const deal = dealRecord({
    editableTerms: [
      "priceMinor",
      "costsMinor",
      "buyerFeeBps",
      "sellerCommissionBps",
      "vatTreatment",
      "partiesDisclosed",
      "offerExpiresAt",
    ],
  });
  const all = deal.editableTerms;

  it("sends nothing when nothing changed", () => {
    expect(changedTerms(deal, initialTermsDraft(deal), all)).toEqual({});
  });

  it("sends only what changed, in the units the API takes", () => {
    const draft = {
      ...initialTermsDraft(deal),
      priceMinor: 5_000_000,
      sellerCommissionRate: "0.12",
      vatTreatment: "margin_scheme",
      partiesDisclosed: true,
    };
    expect(changedTerms(deal, draft, all)).toEqual({
      priceMinor: 5_000_000,
      sellerCommissionBps: 1200,
      vatTreatment: "margin_scheme",
      partiesDisclosed: true,
    });
  });

  it("clears a price or a commission with null", () => {
    const draft = { ...initialTermsDraft(deal), priceMinor: null, sellerCommissionRate: "" };
    expect(changedTerms(deal, draft, all)).toEqual({ priceMinor: null, sellerCommissionBps: null });
  });

  it("never sends a term the person may not change", () => {
    const draft = { ...initialTermsDraft(deal), priceMinor: 1, vatTreatment: "margin_scheme" };
    expect(changedTerms(deal, draft, ["costsMinor"])).toEqual({});
  });
});

describe("validateTerms", () => {
  const all = ["priceMinor", "costsMinor", "buyerFeeBps", "sellerCommissionBps"] as const;
  const draft = initialTermsDraft(dealRecord());

  it("accepts the deal as it is", () => {
    expect(validateTerms(draft, all)).toEqual({});
  });

  it("says what is wrong with each field, in a sentence", () => {
    const errors = validateTerms(
      { ...draft, priceMinor: 0, costsMinor: null, buyerFeeRate: "", sellerCommissionRate: null },
      all,
    );
    expect(errors).toEqual({
      priceMinor: "Enter a price above £0.00, or leave it empty until one is agreed.",
      costsMinor: "Enter the agreed costs, or £0.00 for none.",
      buyerFeeBps: "Enter the buyer's fee as a percentage, or 0 for none.",
      sellerCommissionBps: "Enter the commission as a percentage.",
    });
  });

  it("rejects a rate above 100%", () => {
    expect(validateTerms({ ...draft, buyerFeeRate: "1.5" }, all).buyerFeeBps).toBe(
      "The buyer's fee must be between 0% and 100%.",
    );
  });

  it("ignores fields that are not open", () => {
    expect(validateTerms({ ...draft, priceMinor: 0 }, ["costsMinor"])).toEqual({});
  });
});
