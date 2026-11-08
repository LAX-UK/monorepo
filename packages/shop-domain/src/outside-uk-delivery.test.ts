import { describe, expect, it } from "vitest";
import {
  DEFAULT_DELIVERY_REGIONS,
  DEFAULT_EXPORT_RESTRICTED_COUNTRIES,
  type DeliveryRegion,
} from "./delivery-regions.js";
import {
  GUEST_QUOTE_HOLD_WORKING_DAYS_DEFAULT,
  MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN,
  MAX_OPEN_QUOTE_REQUESTS_PER_BUYER,
  MAX_OPEN_QUOTE_REQUESTS_PER_GUEST_IP,
  QUOTE_HOLD_WORKING_DAYS,
  addWorkingDays,
  assessOutsideUkDelivery,
  outsideUkAddressIssues,
  quoteHoldUntil,
} from "./outside-uk-delivery.js";

const regions = DEFAULT_DELIVERY_REGIONS;
const restricted = DEFAULT_EXPORT_RESTRICTED_COUNTRIES;
const withRate = (id: string, fixedPricePence: number | null): DeliveryRegion[] =>
  regions.map((region) => (region.id === id ? { ...region, fixedPricePence } : region));

describe("assessOutsideUkDelivery", () => {
  it("leaves the UK to ordinary checkout", () => {
    expect(assessOutsideUkDelivery("gb", regions, restricted)).toEqual({ kind: "in_uk" });
  });

  it("quotes a country in a region that has no fixed rate", () => {
    expect(assessOutsideUkDelivery("DE", regions, restricted)).toEqual({
      kind: "quote",
      country: "DE",
      regionId: "eu",
    });
  });

  it("quotes a country outside the four regions", () => {
    expect(assessOutsideUkDelivery("BR", regions, restricted)).toEqual({
      kind: "quote",
      country: "BR",
      regionId: null,
    });
  });

  it("charges a region's fixed rate directly once staff set one", () => {
    expect(assessOutsideUkDelivery("us", withRate("north_america", 4500), restricted)).toEqual({
      kind: "fixed",
      country: "US",
      regionId: "north_america",
      pricePence: 4500,
    });
  });

  it("refuses an export-restricted country, whatever region it sits in", () => {
    expect(assessOutsideUkDelivery("RU", regions, restricted)).toEqual({
      kind: "refused",
      country: "RU",
      reason: "export_restricted",
    });
    expect(assessOutsideUkDelivery("RU", regions, [])).toMatchObject({ kind: "quote" });
  });
});

describe("the quote hold", () => {
  it("lasts three working days, skipping weekends", () => {
    expect(QUOTE_HOLD_WORKING_DAYS).toBe(3);
    // Wednesday 11 November 2026 12:00 UTC: Thursday, Friday, Monday.
    expect(quoteHoldUntil(new Date("2026-11-11T12:00:00Z")).toISOString()).toBe(
      "2026-11-16T12:00:00.000Z",
    );
  });

  it("counts from a weekend as if from the next working day", () => {
    // Saturday 14 November: Monday, Tuesday, Wednesday.
    expect(addWorkingDays(new Date("2026-11-14T09:30:00Z"), 3).toISOString()).toBe(
      "2026-11-18T09:30:00.000Z",
    );
  });

  it("is shorter for a guest, by the number of days it is given", () => {
    expect(GUEST_QUOTE_HOLD_WORKING_DAYS_DEFAULT).toBeLessThan(QUOTE_HOLD_WORKING_DAYS);
    // Wednesday 11 November at noon: one working day is Thursday.
    expect(quoteHoldUntil(new Date("2026-11-11T12:00:00Z"), 1).toISOString()).toBe(
      "2026-11-12T12:00:00.000Z",
    );
  });

  it("caps open holds tightest per browser, then per buyer, then per network", () => {
    expect(MAX_OPEN_QUOTE_REQUESTS_PER_BASKET_TOKEN).toBeLessThan(
      MAX_OPEN_QUOTE_REQUESTS_PER_BUYER,
    );
    expect(MAX_OPEN_QUOTE_REQUESTS_PER_BUYER).toBeLessThan(MAX_OPEN_QUOTE_REQUESTS_PER_GUEST_IP);
  });

  it("does not move the date it is given", () => {
    const from = new Date("2026-11-11T12:00:00Z");
    quoteHoldUntil(from);
    expect(from.toISOString()).toBe("2026-11-11T12:00:00.000Z");
  });
});

describe("outsideUkAddressIssues", () => {
  const good = {
    recipientName: "Anna Weber",
    line1: "Friedrichstrasse 12",
    city: "Berlin",
    postcode: "10117",
    country: "DE",
    phone: "+49 30 1234567",
  };

  it("accepts a complete address", () => {
    expect(outsideUkAddressIssues(good)).toEqual([]);
  });

  it("asks for each missing part by name", () => {
    expect(
      outsideUkAddressIssues({ ...good, recipientName: " ", line1: "", city: "", postcode: "" }),
    ).toEqual([
      { field: "recipientName", reason: "required" },
      { field: "line1", reason: "required" },
      { field: "city", reason: "required" },
      { field: "postcode", reason: "required" },
    ]);
  });

  it("does not hold a postal code to any one country's format", () => {
    expect(outsideUkAddressIssues({ ...good, postcode: "SW-1" })).toEqual([]);
    expect(outsideUkAddressIssues({ ...good, postcode: "x".repeat(21) })).toEqual([
      { field: "postcode", reason: "too_long" },
    ]);
  });

  it("refuses the UK and unknown countries", () => {
    expect(outsideUkAddressIssues({ ...good, country: "GB" })).toEqual([
      { field: "country", reason: "united_kingdom" },
    ]);
    expect(outsideUkAddressIssues({ ...good, country: "XX" })).toEqual([
      { field: "country", reason: "unknown_country" },
    ]);
    expect(outsideUkAddressIssues({ ...good, country: "" })).toEqual([
      { field: "country", reason: "required" },
    ]);
  });

  it("needs a phone a courier could ring", () => {
    expect(outsideUkAddressIssues({ ...good, phone: "" })).toEqual([
      { field: "phone", reason: "required" },
    ]);
    expect(outsideUkAddressIssues({ ...good, phone: "call me" })).toEqual([
      { field: "phone", reason: "invalid_phone" },
    ]);
  });
});
