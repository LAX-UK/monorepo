import type { DeliveryRegionView } from "@auction/shop-contracts";
import { describe, expect, it } from "vitest";
import {
  checkRegionForm,
  checkRestrictedCountries,
  notDeliveredToSentence,
  regionFormValues,
  regionIssueMessages,
  regionRows,
} from "./delivery-regions";

const region = (over: Partial<DeliveryRegionView> = {}): DeliveryRegionView => ({
  id: "eu",
  name: "European Union",
  standard: { minDays: 10, maxDays: 15 },
  specialist: { minDays: 15, maxDays: 25 },
  fixedPricePence: null,
  countries: ["DE", "FR"],
  ...over,
});

describe("regionRows", () => {
  it("lists each region, then everywhere else as a quote that cannot be edited", () => {
    const rows = regionRows([
      region(),
      region({ id: "uk", name: "United Kingdom", fixedPricePence: 1500 }),
    ]);
    expect(rows.map((r) => [r.name, r.standard, r.price, r.editable])).toEqual([
      ["European Union", "10 to 15", "Quote", true],
      ["United Kingdom", "10 to 15", "£15.00 fixed", true],
      ["Everywhere else", "Not stated", "Quote", false],
    ]);
  });
});

describe("checkRegionForm", () => {
  const values = regionFormValues(region());

  it("returns the body for a valid form", () => {
    expect(checkRegionForm("eu", values)).toEqual({
      ok: true,
      body: {
        standardMinDays: 10,
        standardMaxDays: 15,
        specialistMinDays: 15,
        specialistMaxDays: 25,
        fixedPricePence: null,
      },
    });
  });

  it("says each empty field in its own words", () => {
    const result = checkRegionForm("eu", { ...values, standardMin: "", specialistMax: " " });
    expect(result).toEqual({
      ok: false,
      errors: {
        standardMinDays: "Enter the number of working days",
        specialistMaxDays: "Enter the number of working days",
      },
    });
  });

  it("names a minimum above the maximum", () => {
    const result = checkRegionForm("eu", { ...values, standardMin: "20", standardMax: "10" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.standardMinDays).toBe(
        "The shortest time can't be longer than the longest",
      );
    }
  });

  it("needs an amount once a fixed price is chosen, and sends it in pence", () => {
    const empty = checkRegionForm("eu", { ...values, priceMode: "fixed", pricePence: null });
    expect(empty).toEqual({ ok: false, errors: { fixedPricePence: "Enter the price in pounds" } });
    const priced = checkRegionForm("eu", { ...values, priceMode: "fixed", pricePence: 4500 });
    expect(priced.ok && priced.body.fixedPricePence).toBe(4500);
  });

  it("sends no price when the region is quoted, whatever was typed before", () => {
    const quoted = checkRegionForm("eu", { ...values, priceMode: "quote", pricePence: 4500 });
    expect(quoted.ok && quoted.body.fixedPricePence).toBeNull();
  });

  it("rejects non-numeric days", () => {
    const result = checkRegionForm("eu", { ...values, standardMin: "ten" });
    expect(result.ok).toBe(false);
  });
});

describe("messages", () => {
  it("turns the server's reasons into the same sentences", () => {
    expect(regionIssueMessages([{ field: "standardMinDays", reason: "min_above_max" }])).toEqual({
      standardMinDays: "The shortest time can't be longer than the longest",
    });
  });

  it("checks the country list with the domain's rules", () => {
    expect(checkRestrictedCountries(["RU", "SY"])).toBeNull();
    expect(checkRestrictedCountries(["GB"])).toBe("The United Kingdom can't be on this list");
    expect(checkRestrictedCountries(["RU", "RU"])).toBe("This country is in the list twice");
  });

  it("says an empty list in words", () => {
    expect(notDeliveredToSentence([])).toBe("No countries. Every country can be quoted.");
    expect(
      notDeliveredToSentence([
        { code: "RU", name: "Russia" },
        { code: "SY", name: "Syria" },
      ]),
    ).toBe("Russia, Syria");
  });
});
