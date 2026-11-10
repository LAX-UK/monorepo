import { isValidSaleTimeZone } from "@auction/validators";
import { describe, expect, it } from "vitest";
import { zoneForVenueCountry } from "./venue-country-zone";

describe("zoneForVenueCountry", () => {
  it.each([
    ["United Kingdom", "Europe/London"],
    ["  united   kingdom ", "Europe/London"],
    ["France", "Europe/Paris"],
    ["United Arab Emirates", "Asia/Dubai"],
  ])("maps %s to %s", (country, zone) => {
    expect(zoneForVenueCountry(country)).toBe(zone);
  });

  it("leaves countries with several zones, unknown names and blanks to staff", () => {
    expect(zoneForVenueCountry("United States")).toBeNull();
    expect(zoneForVenueCountry("Australia")).toBeNull();
    expect(zoneForVenueCountry("Narnia")).toBeNull();
    expect(zoneForVenueCountry("")).toBeNull();
    expect(zoneForVenueCountry(null)).toBeNull();
    expect(zoneForVenueCountry(undefined)).toBeNull();
  });
});

describe("the country table", () => {
  it("only names zones a sale may use", () => {
    const countries = [
      "United Kingdom",
      "Ireland",
      "France",
      "Monaco",
      "Germany",
      "Italy",
      "Spain",
      "Portugal",
      "Netherlands",
      "Belgium",
      "Switzerland",
      "Austria",
      "Greece",
      "Sweden",
      "Denmark",
      "Norway",
      "United Arab Emirates",
      "Qatar",
      "Saudi Arabia",
      "India",
      "Singapore",
      "Hong Kong",
      "Japan",
      "South Korea",
      "New Zealand",
    ];
    for (const country of countries) {
      expect(isValidSaleTimeZone(zoneForVenueCountry(country))).toBe(true);
    }
  });
});
