import { describe, expect, it } from "vitest";
import {
  BandedBuyerPremiumPolicy,
  FlatRateBuyerPremiumPolicy,
  STANDARD_BUYER_PREMIUM,
  STANDARD_BUYER_PREMIUM_BANDS,
  buildBuyerPremiumPolicy,
  buyerPremiumTiersSchema,
  isBandedPremiumPolicyId,
  lotPremiumDiffersFromSale,
  majorToMinor,
  minorToMajor,
  newSaleBuyerPremium,
  rateToTenThousandths,
  resolveBuyerPremium,
  roundPremiumMinor,
  standardBuyerPremiumBands,
} from "./buyer-premium.js";

const standard = new BandedBuyerPremiumPolicy(STANDARD_BUYER_PREMIUM_BANDS);

describe("the standard premium (Conditions of Sale, clause 11)", () => {
  it("is 15% up to £500,000 and 10% above", () => {
    expect(STANDARD_BUYER_PREMIUM_BANDS).toEqual([
      { hammerThresholdMinor: 0, rate: "0.1500" },
      { hammerThresholdMinor: 50_000_000, rate: "0.1000" },
    ]);
    expect(STANDARD_BUYER_PREMIUM).toEqual({ kind: "bands", bands: STANDARD_BUYER_PREMIUM_BANDS });
  });

  it("cannot be changed in place, and copies for storage are independent", () => {
    expect(Object.isFrozen(STANDARD_BUYER_PREMIUM_BANDS)).toBe(true);
    const copy = standardBuyerPremiumBands();
    copy[0] = { hammerThresholdMinor: 0, rate: "0.2500" };
    expect(STANDARD_BUYER_PREMIUM_BANDS[0]?.rate).toBe("0.1500");
  });
});

describe("banded premium, charged slice by slice", () => {
  it.each([
    // hammer pence, premium pence, why
    [49_999_999, 7_500_000, "£499,999.99: 15% of all of it (7,499,999.85p rounds up)"],
    [50_000_000, 7_500_000, "£500,000: 15% of £500,000"],
    [50_000_001, 7_500_000, "£500,000.01: + 10% of 1p (0.1p rounds down)"],
    [50_000_005, 7_500_001, "£500,000.05: + 10% of 5p (0.5p rounds up)"],
    [60_000_000, 8_500_000, "£600,000: 15% of £500,000 + 10% of £100,000"],
    [100_000_000, 12_500_000, "£1,000,000: £75,000 + £50,000"],
    [0, 0, "nothing on a zero hammer"],
  ])("hammer %i pence → %i pence (%s)", (hammer, premium) => {
    expect(standard.computePremiumMinor(hammer)).toBe(premium);
  });

  it("never drops at the band edge", () => {
    let previous = -1;
    for (let hammer = 49_999_900; hammer <= 50_000_100; hammer++) {
      const premium = standard.computePremiumMinor(hammer);
      expect(premium).toBeGreaterThanOrEqual(previous);
      previous = premium;
    }
  });

  it("splits the hammer into the slices it is charged on", () => {
    expect(standard.breakdown(60_000_000)).toEqual([
      { rate: "0.1500", baseMinor: 50_000_000 },
      { rate: "0.1000", baseMinor: 10_000_000 },
    ]);
    expect(standard.breakdown(50_000_000)).toEqual([{ rate: "0.1500", baseMinor: 50_000_000 }]);
    expect(standard.breakdown(0)).toEqual([]);
  });

  it("generalises to any staff-defined ascending bands", () => {
    const three = new BandedBuyerPremiumPolicy([
      { hammerThresholdMinor: 0, rate: "0.25" },
      { hammerThresholdMinor: 10_000_000, rate: "0.20" },
      { hammerThresholdMinor: 50_000_000, rate: "0.12" },
    ]);
    // £700,000: 25% of £100,000 + 20% of £400,000 + 12% of £200,000 = 25k + 80k + 24k
    expect(three.computePremiumMinor(70_000_000)).toBe(12_900_000);
    expect(three.rateFor(70_000_000)).toBe("0.12");
    expect(three.rateFor(5_000_000)).toBe("0.25");
  });

  it("sorts bands given out of order and refuses bands that do not start at 0", () => {
    const reversed = new BandedBuyerPremiumPolicy([...STANDARD_BUYER_PREMIUM_BANDS].reverse());
    expect(reversed.computePremiumMinor(60_000_000)).toBe(8_500_000);
    expect(reversed.id).toBe(standard.id);
    expect(
      () => new BandedBuyerPremiumPolicy([{ hammerThresholdMinor: 100, rate: "0.1" }]),
    ).toThrow();
    expect(() => new BandedBuyerPremiumPolicy([])).toThrow();
    expect(
      () =>
        new BandedBuyerPremiumPolicy([
          { hammerThresholdMinor: 0, rate: "0.1" },
          { hammerThresholdMinor: 0, rate: "0.2" },
        ]),
    ).toThrow();
  });

  it("has a stable id that names its bands", () => {
    expect(standard.id).toBe("bands:[0:0.1500,50000000:0.1000]");
    expect(isBandedPremiumPolicyId(standard.id)).toBe(true);
    expect(isBandedPremiumPolicyId("tiered:[]")).toBe(true);
    expect(isBandedPremiumPolicyId("flat:0.2500")).toBe(false);
  });
});

describe("roundPremiumMinor (half up to the penny, integer maths)", () => {
  it("rounds exact halves up, never to even", () => {
    expect(roundPremiumMinor(100, "0.005")).toBe(1); // 0.5p → 1p
    expect(roundPremiumMinor(300, "0.005")).toBe(2); // 1.5p → 2p
    expect(roundPremiumMinor(500, "0.005")).toBe(3); // 2.5p → 3p (half-to-even gave 2p)
    expect(roundPremiumMinor(12_345, "0.10")).toBe(1_235); // 1,234.5p → 1,235p
  });

  it("rounds below a half down and above it up", () => {
    expect(roundPremiumMinor(12_344, "0.10")).toBe(1_234); // 1,234.4p
    expect(roundPremiumMinor(12_346, "0.10")).toBe(1_235); // 1,234.6p
    expect(roundPremiumMinor(1, "0.4999")).toBe(0); // 0.4999p
    expect(roundPremiumMinor(1, "0.5")).toBe(1); // 0.5p
  });

  it("is exact where a float is not", () => {
    // 0.07 × 0.15 in floats is 0.010500000000000001; in integers it is exactly 1.05p.
    expect(roundPremiumMinor(7, "0.15")).toBe(1);
    // £1,234.57 at 23.33%: 28,802.5181p exactly.
    expect(roundPremiumMinor(123_457, "0.2333")).toBe(28_803);
    // A large hammer stays exact: £90,071,992,547.41 at 0.01%.
    expect(roundPremiumMinor(9_007_199_254_741, "0.0001")).toBe(900_719_925);
  });

  it("charges nothing for a bad rate or hammer", () => {
    expect(roundPremiumMinor(10_000, "oops")).toBe(0);
    expect(roundPremiumMinor(10_000, "1.5")).toBe(0);
    expect(roundPremiumMinor(-10_000, "0.25")).toBe(0);
    expect(roundPremiumMinor(Number.NaN, "0.25")).toBe(0);
  });

  it("reads rates from their digits", () => {
    expect(rateToTenThousandths("0.15")).toBe(1500n);
    expect(rateToTenThousandths("0.1500")).toBe(1500n);
    expect(rateToTenThousandths("1")).toBe(10_000n);
    expect(rateToTenThousandths("1.0001")).toBeNull();
    expect(rateToTenThousandths("0.12345")).toBeNull();
    expect(rateToTenThousandths("")).toBeNull();
    expect(rateToTenThousandths(null)).toBeNull();
  });
});

describe("majorToMinor / minorToMajor", () => {
  it("round-trips currency precisely, without floats", () => {
    expect(majorToMinor("123.45")).toBe(12_345);
    expect(majorToMinor("0")).toBe(0);
    expect(majorToMinor("1000000")).toBe(100_000_000);
    expect(majorToMinor("499999.99")).toBe(49_999_999);
    expect(majorToMinor("0.29")).toBe(29);
    expect(minorToMajor(12_345)).toBe("123.45");
    expect(minorToMajor(0)).toBe("0.00");
    expect(minorToMajor(8_500_000)).toBe("85000.00");
  });
  it("rejects negative / malformed major strings", () => {
    expect(majorToMinor("-1")).toBe(0);
    expect(majorToMinor("abc")).toBe(0);
    expect(majorToMinor("")).toBe(0);
  });
});

describe("FlatRateBuyerPremiumPolicy", () => {
  it("applies one rate to the whole hammer", () => {
    const p = new FlatRateBuyerPremiumPolicy("0.1000");
    expect(p.computePremiumMinor(100_000)).toBe(10_000);
    expect(p.computePremiumMajor("1000.00")).toBe("100.00");
    expect(p.breakdown(100_000)).toEqual([{ rate: "0.1000", baseMinor: 100_000 }]);
    expect(p.id).toBe("flat:0.1000");
  });
});

describe("resolveBuyerPremium (which premium a lot charges)", () => {
  const flatSale = { buyerPremiumRate: "0.2000", buyerPremiumTiers: null };
  const bandedSale = {
    buyerPremiumRate: "0.2500",
    buyerPremiumTiers: STANDARD_BUYER_PREMIUM_BANDS,
  };

  it("uses the lot's own premium first, even over the sale's bands", () => {
    const r = resolveBuyerPremium({ lotRate: "0.1800", sale: bandedSale });
    expect(r.source).toBe("lot");
    expect(r.schedule).toEqual({ kind: "flat", rate: "0.1800" });
    expect(r.policy.computePremiumMinor(60_000_000)).toBe(10_800_000);
  });

  it("then the sale's bands, ignoring the sale's flat rate", () => {
    const r = resolveBuyerPremium({ lotRate: null, sale: bandedSale });
    expect(r.source).toBe("sale_bands");
    expect(r.policy.computePremiumMinor(60_000_000)).toBe(8_500_000);
  });

  it("then the sale's flat rate", () => {
    const r = resolveBuyerPremium({ lotRate: null, sale: flatSale });
    expect(r.source).toBe("sale_flat");
    expect(r.policy.computePremiumMinor(60_000_000)).toBe(12_000_000);
  });

  it("treats empty bands as no bands", () => {
    const r = resolveBuyerPremium({ lotRate: null, sale: { ...flatSale, buyerPremiumTiers: [] } });
    expect(r.source).toBe("sale_flat");
  });

  it("never falls back to 25%: a lot without a sale or rate pays the standard premium", () => {
    for (const lotRate of [null, undefined, "", "  "]) {
      const r = resolveBuyerPremium({ lotRate, sale: null });
      expect(r.source).toBe("standard");
      expect(r.policy.computePremiumMinor(60_000_000)).toBe(8_500_000);
    }
  });

  it("ignores a lot rate that is not a rate", () => {
    expect(resolveBuyerPremium({ lotRate: "abc", sale: flatSale }).source).toBe("sale_flat");
  });

  it("a zero lot rate is a real override (no premium on this lot)", () => {
    const r = resolveBuyerPremium({ lotRate: "0.0000", sale: bandedSale });
    expect(r.source).toBe("lot");
    expect(r.policy.computePremiumMinor(60_000_000)).toBe(0);
  });

  it("builds the policy for a schedule directly", () => {
    expect(buildBuyerPremiumPolicy(STANDARD_BUYER_PREMIUM).id).toBe(standard.id);
    expect(buildBuyerPremiumPolicy({ kind: "flat", rate: "0.25" }).id).toBe("flat:0.25");
  });
});

describe("lotPremiumDiffersFromSale", () => {
  const banded = { buyerPremiumRate: "0.2500", buyerPremiumTiers: STANDARD_BUYER_PREMIUM_BANDS };
  const flat = { buyerPremiumRate: "0.2500", buyerPremiumTiers: null };

  it("is false for a lot that uses its sale's premium", () => {
    expect(lotPremiumDiffersFromSale(null, banded)).toBe(false);
  });
  it("is true for a 25% lot in a sale on the standard bands", () => {
    expect(lotPremiumDiffersFromSale("0.2500", banded)).toBe(true);
  });
  it("is false when the lot's rate is the sale's flat rate, however it is written", () => {
    expect(lotPremiumDiffersFromSale("0.25", flat)).toBe(false);
  });
  it("is false when the sale has a single band at the lot's rate", () => {
    const single = { ...flat, buyerPremiumTiers: [{ hammerThresholdMinor: 0, rate: "0.2" }] };
    expect(lotPremiumDiffersFromSale("0.2000", single)).toBe(false);
  });
});

describe("buyerPremiumTiersSchema", () => {
  it("accepts the standard bands", () => {
    expect(buyerPremiumTiersSchema.safeParse(standardBuyerPremiumBands()).success).toBe(true);
  });
  it("rejects when the first band isn't 0", () => {
    const r = buyerPremiumTiersSchema.safeParse([{ hammerThresholdMinor: 100, rate: "0.1" }]);
    expect(r.success).toBe(false);
  });
  it("rejects non-ascending thresholds", () => {
    const r = buyerPremiumTiersSchema.safeParse([
      { hammerThresholdMinor: 0, rate: "0.1" },
      { hammerThresholdMinor: 0, rate: "0.2" },
    ]);
    expect(r.success).toBe(false);
  });
  it("rejects a rate outside [0,1]", () => {
    const r = buyerPremiumTiersSchema.safeParse([{ hammerThresholdMinor: 0, rate: "1.5" }]);
    expect(r.success).toBe(false);
  });
});

describe("newSaleBuyerPremium", () => {
  it("gives a sale created without a premium the standard bands", () => {
    expect(newSaleBuyerPremium({})).toEqual({ buyerPremiumTiers: standardBuyerPremiumBands() });
  });
  it("keeps a flat rate staff chose", () => {
    expect(newSaleBuyerPremium({ buyerPremiumRate: "0.2" })).toEqual({
      buyerPremiumRate: "0.2",
      buyerPremiumTiers: null,
    });
  });
  it("keeps bands staff chose", () => {
    const bands = [{ hammerThresholdMinor: 0, rate: "0.2" }];
    expect(newSaleBuyerPremium({ buyerPremiumTiers: bands }).buyerPremiumTiers).toEqual(bands);
  });
});
