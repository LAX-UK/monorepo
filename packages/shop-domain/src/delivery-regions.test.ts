import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_REGIONS,
  DEFAULT_EXPORT_RESTRICTED_COUNTRIES,
  DELIVERY_REGION_COUNTRIES,
  DELIVERY_REGION_IDS,
  type DeliveryRegionEdit,
  FIXED_PRICE_MAX_PENCE,
  ISO_COUNTRY_CODES,
  LEAD_TIME_MAX_DAYS,
  deliveryDestination,
  deliveryRegionIssues,
  formatLeadTime,
  isIsoCountryCode,
  isQuotedRegion,
  restrictedCountryIssues,
} from "./delivery-regions.js";
import { FULFILMENT_SURCHARGE_PENCE } from "./fulfilment-options.js";

const region = (id: (typeof DELIVERY_REGION_IDS)[number]) => {
  const found = DEFAULT_DELIVERY_REGIONS.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
};

const edit = (over: Partial<DeliveryRegionEdit> = {}): DeliveryRegionEdit => ({
  standard: { minDays: 10, maxDays: 15 },
  specialist: { minDays: 15, maxDays: 25 },
  fixedPricePence: null,
  ...over,
});

describe("the default regions", () => {
  it("are lax.bid/shipping's four regions and lead times", () => {
    expect(
      DEFAULT_DELIVERY_REGIONS.map((r) => [
        r.id,
        formatLeadTime(r.standard),
        formatLeadTime(r.specialist),
      ]),
    ).toEqual([
      ["uk", "5 to 10", "10 to 20"],
      ["eu", "10 to 15", "15 to 25"],
      ["north_america", "12 to 18", "18 to 30"],
      ["asia_pacific", "14 to 21", "21 to 35"],
    ]);
  });

  it("quote everywhere except the UK, which keeps the price checkout charges today", () => {
    expect(isQuotedRegion(region("uk"))).toBe(false);
    expect(region("uk").fixedPricePence).toBe(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery);
    for (const id of ["eu", "north_america", "asia_pacific"] as const) {
      expect(isQuotedRegion(region(id))).toBe(true);
    }
  });

  it("have valid lead times of their own", () => {
    for (const r of DEFAULT_DELIVERY_REGIONS) {
      expect(
        deliveryRegionIssues(r, {
          standard: r.standard,
          specialist: r.specialist,
          fixedPricePence: r.fixedPricePence,
        }),
      ).toEqual([]);
    }
  });
});

describe("the countries", () => {
  it("name 27 EU countries, 14 in Asia Pacific, the US and Canada, and the UK", () => {
    expect(DELIVERY_REGION_COUNTRIES.eu).toHaveLength(27);
    expect(DELIVERY_REGION_COUNTRIES.asia_pacific).toHaveLength(14);
    expect(DELIVERY_REGION_COUNTRIES.north_america).toEqual(["US", "CA"]);
    expect(DELIVERY_REGION_COUNTRIES.uk).toEqual(["GB"]);
  });

  it("are real countries, each in one region only", () => {
    const all = DELIVERY_REGION_IDS.flatMap((id) => DELIVERY_REGION_COUNTRIES[id]);
    expect(new Set(all).size).toBe(all.length);
    for (const code of all) expect(isIsoCountryCode(code)).toBe(true);
  });

  it("have no duplicates in the full list, which holds the 249 assigned codes", () => {
    expect(new Set(ISO_COUNTRY_CODES).size).toBe(ISO_COUNTRY_CODES.length);
    expect(ISO_COUNTRY_CODES).toHaveLength(249);
    expect(isIsoCountryCode("XX")).toBe(false);
  });

  it("start with the UK export restrictions list", () => {
    expect(DEFAULT_EXPORT_RESTRICTED_COUNTRIES).toEqual(["BY", "IR", "KP", "RU", "SY"]);
  });
});

describe("deliveryDestination", () => {
  const restricted = DEFAULT_EXPORT_RESTRICTED_COUNTRIES;
  const where = (code: string) => deliveryDestination(code, DEFAULT_DELIVERY_REGIONS, restricted);

  it("puts a country in its region, whatever the case of the code", () => {
    expect(where("de")).toMatchObject({ kind: "region", region: { id: "eu" } });
    expect(where("US")).toMatchObject({ kind: "region", region: { id: "north_america" } });
    expect(where("jp")).toMatchObject({ kind: "region", region: { id: "asia_pacific" } });
    expect(where("GB")).toMatchObject({ kind: "region", region: { id: "uk" } });
  });

  it("quotes any other country, with no time stated", () => {
    expect(where("BR")).toEqual({ kind: "quote_elsewhere" });
    expect(where("ZA")).toEqual({ kind: "quote_elsewhere" });
  });

  it("does not deliver to a restricted country, and suggests collection", () => {
    for (const code of restricted) expect(where(code)).toEqual({ kind: "not_delivered" });
  });

  it("lets the restriction win over a region, if staff list a country in one", () => {
    expect(deliveryDestination("DE", DEFAULT_DELIVERY_REGIONS, ["DE"])).toEqual({
      kind: "not_delivered",
    });
  });

  it("reads the region as staff have changed it", () => {
    const changed = DEFAULT_DELIVERY_REGIONS.map((r) =>
      r.id === "eu" ? { ...r, fixedPricePence: 4500 } : r,
    );
    const found = deliveryDestination("FR", changed, restricted);
    expect(found).toMatchObject({ kind: "region", region: { fixedPricePence: 4500 } });
  });
});

describe("deliveryRegionIssues", () => {
  const eu = region("eu");

  it("accepts lead times and a fixed price", () => {
    expect(deliveryRegionIssues(eu, edit({ fixedPricePence: 4500 }))).toEqual([]);
    expect(deliveryRegionIssues(eu, edit())).toEqual([]);
  });

  it("accepts a span of one value", () => {
    expect(deliveryRegionIssues(eu, edit({ standard: { minDays: 7, maxDays: 7 } }))).toEqual([]);
  });

  it("refuses a minimum above the maximum, naming the minimum", () => {
    expect(deliveryRegionIssues(eu, edit({ standard: { minDays: 20, maxDays: 10 } }))).toEqual([
      { field: "standardMinDays", reason: "min_above_max" },
    ]);
    expect(deliveryRegionIssues(eu, edit({ specialist: { minDays: 30, maxDays: 25 } }))).toEqual([
      { field: "specialistMinDays", reason: "min_above_max" },
    ]);
  });

  it("refuses days that are not whole, below one, or past the limit", () => {
    expect(deliveryRegionIssues(eu, edit({ standard: { minDays: 1.5, maxDays: 10 } }))).toEqual([
      { field: "standardMinDays", reason: "not_a_whole_number" },
    ]);
    expect(deliveryRegionIssues(eu, edit({ standard: { minDays: 0, maxDays: 10 } }))).toEqual([
      { field: "standardMinDays", reason: "below_one" },
    ]);
    expect(
      deliveryRegionIssues(
        eu,
        edit({ specialist: { minDays: 5, maxDays: LEAD_TIME_MAX_DAYS + 1 } }),
      ),
    ).toEqual([{ field: "specialistMaxDays", reason: "too_long" }]);
  });

  it("refuses a fixed price that is not whole pence, below one penny, or absurd", () => {
    expect(deliveryRegionIssues(eu, edit({ fixedPricePence: 12.5 }))).toEqual([
      { field: "fixedPricePence", reason: "price_not_whole_pence" },
    ]);
    expect(deliveryRegionIssues(eu, edit({ fixedPricePence: 0 }))).toEqual([
      { field: "fixedPricePence", reason: "price_below_one_penny" },
    ]);
    expect(deliveryRegionIssues(eu, edit({ fixedPricePence: FIXED_PRICE_MAX_PENCE + 1 }))).toEqual([
      { field: "fixedPricePence", reason: "price_too_high" },
    ]);
  });

  it("reports every problem at once", () => {
    const issues = deliveryRegionIssues(
      eu,
      edit({ standard: { minDays: 0, maxDays: 500 }, fixedPricePence: 0 }),
    );
    expect(issues.map((i) => i.field).sort()).toEqual([
      "fixedPricePence",
      "standardMaxDays",
      "standardMinDays",
    ]);
  });

  it("will not change the UK's price while checkout charges its own", () => {
    const uk = region("uk");
    const ukEdit = (price: number | null) =>
      edit({
        standard: uk.standard,
        specialist: uk.specialist,
        fixedPricePence: price,
      });
    expect(
      deliveryRegionIssues(uk, ukEdit(FULFILMENT_SURCHARGE_PENCE.uk_insured_delivery)),
    ).toEqual([]);
    for (const price of [2000, null]) {
      expect(deliveryRegionIssues(uk, ukEdit(price))).toEqual([
        { field: "fixedPricePence", reason: "uk_price_is_set_in_checkout" },
      ]);
    }
  });
});

describe("restrictedCountryIssues", () => {
  it("accepts a list of real countries, or none", () => {
    expect(restrictedCountryIssues(["RU", "IR"])).toEqual([]);
    expect(restrictedCountryIssues([])).toEqual([]);
  });

  it("refuses an unknown code, a country twice, and the United Kingdom", () => {
    expect(restrictedCountryIssues(["XX", "RU", "RU", "GB"])).toEqual([
      { code: "XX", reason: "unknown_country" },
      { code: "RU", reason: "duplicate" },
      { code: "GB", reason: "united_kingdom" },
    ]);
  });

  it("refuses a list longer than a real one", () => {
    const many = ISO_COUNTRY_CODES.filter((code) => code !== "GB").slice(0, 61);
    expect(restrictedCountryIssues(many).at(-1)?.reason).toBe("too_many");
  });
});

describe("formatLeadTime", () => {
  it("says a span, or one number when they match", () => {
    expect(formatLeadTime({ minDays: 5, maxDays: 10 })).toBe("5 to 10");
    expect(formatLeadTime({ minDays: 7, maxDays: 7 })).toBe("7");
  });
});
