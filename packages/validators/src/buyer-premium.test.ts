import { describe, expect, it } from "vitest";
import {
  FlatRateBuyerPremiumPolicy,
  TieredBuyerPremiumPolicy,
  buildBuyerPremiumPolicy,
  buyerPremiumTiersSchema,
  majorToMinor,
  minorToMajor,
  roundPremiumMinor,
} from "./buyer-premium.js";

describe("majorToMinor / minorToMajor", () => {
  it("round-trips currency precisely", () => {
    expect(majorToMinor("123.45")).toBe(12_345);
    expect(majorToMinor("0")).toBe(0);
    expect(majorToMinor("1000000")).toBe(100_000_000);
    expect(minorToMajor(12_345)).toBe("123.45");
    expect(minorToMajor(0)).toBe("0.00");
  });
  it("rejects negative / malformed major strings", () => {
    expect(majorToMinor("-1")).toBe(0);
    expect(majorToMinor("abc")).toBe(0);
    expect(majorToMinor("")).toBe(0);
  });
});

describe("roundPremiumMinor (banker's rounding)", () => {
  it("rounds to even on .50 ties", () => {
    expect(roundPremiumMinor(100, "0.005")).toBe(0); // 0.50 → 0
    expect(roundPremiumMinor(300, "0.005")).toBe(2); // 1.50 → 2
    expect(roundPremiumMinor(500, "0.005")).toBe(2); // 2.50 → 2
    expect(roundPremiumMinor(700, "0.005")).toBe(4); // 3.50 → 4
  });
  it("rounds non-tie values normally", () => {
    // 12_345 × 0.10 = 1234.5 exactly → tie → nearest even = 1234
    expect(roundPremiumMinor(12_345, "0.10")).toBe(1_234);
    // 12_355 × 0.10 = 1235.5 exactly → tie → nearest even = 1236
    expect(roundPremiumMinor(12_355, "0.10")).toBe(1_236);
    // 12_346 × 0.10 = 1234.6 (not a tie) → 1235
    expect(roundPremiumMinor(12_346, "0.10")).toBe(1_235);
  });
});

describe("FlatRateBuyerPremiumPolicy", () => {
  it("applies a single rate to the whole hammer", () => {
    const p = new FlatRateBuyerPremiumPolicy("0.1000");
    expect(p.computePremiumMinor(100_000)).toBe(10_000);
    expect(p.computePremiumMajor("1000.00")).toBe("100.00");
    expect(p.id).toBe("flat:0.1000");
  });
  it("treats invalid rate as zero", () => {
    const p = new FlatRateBuyerPremiumPolicy("oops");
    expect(p.computePremiumMinor(10_000)).toBe(0);
  });
});

describe("TieredBuyerPremiumPolicy (band-based)", () => {
  const tiers = [
    { hammerThresholdMinor: 0, rate: "0.1500" },
    { hammerThresholdMinor: 50_000_000, rate: "0.1000" }, // £500,000.00
  ];
  it("picks the low-band rate just under the threshold", () => {
    const p = new TieredBuyerPremiumPolicy(tiers);
    // £499,999.99 → 15% on the whole hammer
    expect(p.computePremiumMinor(49_999_999)).toBe(7_500_000); // 49_999_999 × 0.15 = 7_499_999.85 → 7_500_000
    expect(p.computePremiumMajor("499999.99")).toBe("75000.00");
  });
  it("picks the high-band rate at and above the threshold", () => {
    const p = new TieredBuyerPremiumPolicy(tiers);
    // £500,000.00 → 10% on the whole hammer
    expect(p.computePremiumMinor(50_000_000)).toBe(5_000_000);
    // £750,000 → 10%
    expect(p.computePremiumMinor(75_000_000)).toBe(7_500_000);
  });
  it("composes a stable id", () => {
    const p = new TieredBuyerPremiumPolicy(tiers);
    expect(p.id).toMatch(/^tiered:/);
  });
  it("auto-sorts ascending input", () => {
    const reversed = [
      { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
      { hammerThresholdMinor: 0, rate: "0.1500" },
    ];
    const p = new TieredBuyerPremiumPolicy(reversed);
    expect(p.computePremiumMinor(10_000)).toBe(1_500);
  });
  it("throws when the first tier doesn't cover hammer 0", () => {
    expect(
      () => new TieredBuyerPremiumPolicy([{ hammerThresholdMinor: 100, rate: "0.10" }]),
    ).toThrow(/threshold/i);
  });
});

describe("buildBuyerPremiumPolicy", () => {
  it("falls back to the per-lot flat rate when saleTiers is null", () => {
    const p = buildBuyerPremiumPolicy({ saleTiers: null, lotRate: "0.1000" });
    expect(p).toBeInstanceOf(FlatRateBuyerPremiumPolicy);
    expect(p.computePremiumMinor(50_000)).toBe(5_000);
  });
  it("uses tiered policy when saleTiers are present", () => {
    const p = buildBuyerPremiumPolicy({
      saleTiers: [
        { hammerThresholdMinor: 0, rate: "0.1500" },
        { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
      ],
      lotRate: "0.1000",
    });
    expect(p).toBeInstanceOf(TieredBuyerPremiumPolicy);
    expect(p.computePremiumMinor(10_000)).toBe(1_500); // 15% override
  });
});

describe("buyerPremiumTiersSchema", () => {
  it("accepts a valid two-tier config", () => {
    const result = buyerPremiumTiersSchema.safeParse([
      { hammerThresholdMinor: 0, rate: "0.1500" },
      { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
    ]);
    expect(result.success).toBe(true);
  });
  it("rejects when first tier isn't 0", () => {
    const result = buyerPremiumTiersSchema.safeParse([
      { hammerThresholdMinor: 100, rate: "0.1000" },
    ]);
    expect(result.success).toBe(false);
  });
  it("rejects non-ascending thresholds", () => {
    const result = buyerPremiumTiersSchema.safeParse([
      { hammerThresholdMinor: 0, rate: "0.1500" },
      { hammerThresholdMinor: 0, rate: "0.1000" },
    ]);
    expect(result.success).toBe(false);
  });
  it("rejects rate outside [0,1]", () => {
    const result = buyerPremiumTiersSchema.safeParse([{ hammerThresholdMinor: 0, rate: "2.0000" }]);
    expect(result.success).toBe(false);
  });
});
