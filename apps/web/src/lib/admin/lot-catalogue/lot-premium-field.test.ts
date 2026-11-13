import { STANDARD_BUYER_PREMIUM_BANDS } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { lotPremiumFieldView, salePremiumTermsFor } from "./lot-premium-field";

describe("lot form buyer's premium wording", () => {
  const salePremium = salePremiumTermsFor({
    buyerPremiumRate: "0.25",
    buyerPremiumTiers: [...STANDARD_BUYER_PREMIUM_BANDS],
  });

  it("says the lot uses the sale's premium by default", () => {
    expect(salePremium).toBe("15% up to £500,000, 10% above");
    expect(lotPremiumFieldView({ salePremium, lotRate: "" }).usesSaleLine).toBe(
      "Uses the sale's premium: 15% up to £500,000, 10% above",
    );
  });

  it("asks for the sale when none is chosen yet", () => {
    expect(salePremiumTermsFor(undefined)).toBeNull();
    expect(lotPremiumFieldView({ salePremium: null, lotRate: "" }).usesSaleLine).toBe(
      "Uses the sale's premium. Choose the sale to see it.",
    );
  });

  it("notes an override against the sale's premium", () => {
    expect(lotPremiumFieldView({ salePremium, lotRate: "0.2" }).overrideNote).toBe(
      "This lot charges its own premium: 20% on the hammer. The sale charges 15% up to £500,000, 10% above.",
    );
    expect(lotPremiumFieldView({ salePremium, lotRate: "" }).overrideNote).toBe(
      "This lot will charge its own premium. The sale charges 15% up to £500,000, 10% above.",
    );
  });
});
