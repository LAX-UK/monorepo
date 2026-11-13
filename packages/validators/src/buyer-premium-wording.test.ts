import { describe, expect, it } from "vitest";
import {
  buyerPremiumLineLabel,
  buyerPremiumWorkedExample,
  describeBuyerPremium,
  describeBuyerPremiumBreakdown,
  formatPremiumMoney,
  formatPremiumPercent,
} from "./buyer-premium-wording.js";
import { BandedBuyerPremiumPolicy, STANDARD_BUYER_PREMIUM } from "./buyer-premium.js";

describe("buyer's premium wording", () => {
  it("says the standard premium as the Conditions do", () => {
    expect(describeBuyerPremium(STANDARD_BUYER_PREMIUM)).toBe(
      "15% up to £500,000, then 10% on the part above",
    );
  });

  it("says a flat rate on the hammer", () => {
    expect(describeBuyerPremium({ kind: "flat", rate: "0.25" })).toBe("25% on the hammer");
    expect(describeBuyerPremium({ kind: "flat", rate: "0.125" })).toBe("12.5% on the hammer");
  });

  it("says three or more bands with their ranges", () => {
    expect(
      describeBuyerPremium({
        kind: "bands",
        bands: [
          { hammerThresholdMinor: 0, rate: "0.2" },
          { hammerThresholdMinor: 10_000_000, rate: "0.15" },
          { hammerThresholdMinor: 50_000_000, rate: "0.1" },
        ],
      }),
    ).toBe("20% up to £100,000, 15% from £100,000 to £500,000, then 10% on the part above");
  });

  it("says a single band as one rate", () => {
    expect(
      describeBuyerPremium({ kind: "bands", bands: [{ hammerThresholdMinor: 0, rate: "0.18" }] }),
    ).toBe("18% on the hammer");
  });

  it("formats money in whole pounds where it can", () => {
    expect(formatPremiumMoney(50_000_000)).toBe("£500,000");
    expect(formatPremiumMoney(49_999_999)).toBe("£499,999.99");
    expect(formatPremiumMoney(5)).toBe("£0.05");
    expect(formatPremiumMoney(0)).toBe("£0");
  });

  it("formats percentages from the rate's digits", () => {
    expect(formatPremiumPercent("0.1500")).toBe("15%");
    expect(formatPremiumPercent("0.2333")).toBe("23.33%");
    expect(formatPremiumPercent("1")).toBe("100%");
  });

  it("explains a banded premium slice by slice", () => {
    const policy = new BandedBuyerPremiumPolicy(
      STANDARD_BUYER_PREMIUM.kind === "bands" ? STANDARD_BUYER_PREMIUM.bands : [],
    );
    expect(describeBuyerPremiumBreakdown(policy.breakdown(60_000_000))).toBe(
      "15% of £500,000 + 10% of £100,000",
    );
    expect(describeBuyerPremiumBreakdown(policy.breakdown(40_000_000))).toBe("15% of £400,000");
    expect(buyerPremiumLineLabel(policy.schedule, policy.breakdown(60_000_000))).toBe(
      "Buyer's premium (15% of £500,000 + 10% of £100,000)",
    );
  });

  it("labels a flat premium line with its rate", () => {
    expect(buyerPremiumLineLabel({ kind: "flat", rate: "0.2" }, [])).toBe("Buyer's premium (20%)");
  });

  it("gives a worked example", () => {
    expect(buyerPremiumWorkedExample(STANDARD_BUYER_PREMIUM, 60_000_000)).toBe(
      "On a £600,000 hammer the buyer pays £85,000 premium",
    );
  });
});
