import { describe, expect, it } from "vitest";
import { countryToIso } from "./address-country.js";

describe("countryToIso", () => {
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
    expect(countryToIso(raw)).toBe(expected);
  });

  it.each(["Ruritania", "", "Europe"])("does not guess %j", (raw) => {
    expect(countryToIso(raw)).toBeNull();
  });
});
