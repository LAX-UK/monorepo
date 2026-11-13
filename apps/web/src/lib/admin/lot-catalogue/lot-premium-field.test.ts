import { STANDARD_BUYER_PREMIUM_BANDS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import {
  LOT_PREMIUM_FIELD_DESCRIPTION,
  LOT_PREMIUM_FIELD_PLACEHOLDER,
  lotPremiumFieldView,
  salePremiumTermsFor,
} from "./lot-premium-field";

describe("lot form buyer's premium wording", () => {
  const salePremium = salePremiumTermsFor({
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: [...STANDARD_BUYER_PREMIUM_BANDS],
  });

  it("says the lot uses the sale's premium by default, without repeating the word premium", () => {
    expect(salePremium).toBe("15% up to £500,000, then 10% on the part above");
    expect(lotPremiumFieldView({ salePremium, lotRate: "" }).usesSaleLine).toBe(
      "Same as the sale: 15% up to £500,000, then 10% on the part above",
    );
  });

  it("asks for the sale when none is chosen yet", () => {
    expect(salePremiumTermsFor(undefined)).toBeNull();
    expect(lotPremiumFieldView({ salePremium: null, lotRate: "" }).usesSaleLine).toBe(
      "Same as the sale. Choose the sale to see it.",
    );
  });

  it("shows no warning while the field is blank, because blank saves the sale's premium", () => {
    expect(lotPremiumFieldView({ salePremium, lotRate: "" }).overrideNotice).toBeNull();
    expect(lotPremiumFieldView({ salePremium, lotRate: "  " }).overrideNotice).toBeNull();
  });

  it("warns once the lot has a rate, saying only what the sale charges", () => {
    expect(lotPremiumFieldView({ salePremium, lotRate: "0.2" }).overrideNotice).toEqual({
      title: "This lot has its own premium",
      body: "The sale charges 15% up to £500,000, then 10% on the part above.",
    });
    expect(lotPremiumFieldView({ salePremium: null, lotRate: "0.2" }).overrideNotice).toEqual({
      title: "This lot has its own premium",
      body: null,
    });
  });

  it("suggests an example rate, not a default", () => {
    expect(LOT_PREMIUM_FIELD_PLACEHOLDER).toBe("e.g. 20");
    expect(LOT_PREMIUM_FIELD_DESCRIPTION).toContain("Leave blank to use the sale's.");
  });
});
