import { describe, expect, it } from "vitest";
import { legacyCountryToIso } from "./legacy-country.js";

describe("legacyCountryToIso", () => {
  it.each([
    ["gb", "GB"],
    [" FR ", "FR"],
    ["United Kingdom", "GB"],
    ["england", "GB"],
    ["United  States", "US"],
    ["Germany", "DE"],
    ["Côte d’Ivoire", "CI"],
    ["UAE", "AE"],
  ])("reads %s as %s", (raw, expected) => {
    expect(legacyCountryToIso(raw)).toBe(expected);
  });

  it.each(["Ruritania", "", "Europe"])("does not guess %j", (raw) => {
    expect(legacyCountryToIso(raw)).toBeNull();
  });
});
