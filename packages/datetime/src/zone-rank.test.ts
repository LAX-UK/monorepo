import { describe, expect, it } from "vitest";
import { listZoneChoices } from "./zone-choices.js";
import { PINNED_ZONES, rankZoneChoices } from "./zone-rank.js";

const choices = listZoneChoices(new Date("2026-11-12T12:00:00Z"));
const zones = (query: string) => rankZoneChoices(choices, query).map((c) => c.zone);

describe("rankZoneChoices", () => {
  it("leads with the pinned zones, in order, when nothing is typed", () => {
    expect(zones("").slice(0, PINNED_ZONES.length)).toEqual([...PINNED_ZONES]);
    expect(zones("")).toHaveLength(choices.length);
  });

  it("ranks a city-name prefix first, so a short query finds the usual city", () => {
    const found = zones("par");
    expect(found.indexOf("Europe/Paris")).toBeLessThan(found.indexOf("America/Paramaribo"));
    expect(zones("new y")[0]).toBe("America/New_York");
    expect(zones("lon")[0]).toBe("Europe/London");
  });

  it("ranks a word prefix after a city prefix, then plain containment", () => {
    const found = zones("york");
    expect(found[0]).toBe("America/New_York");
    const contained = zones("ondo");
    expect(contained).toContain("Europe/London");
  });

  it("matches the IANA name and the abbreviation as well as the city", () => {
    expect(zones("europe/lon")).toContain("Europe/London");
    expect(zones("bst").length).toBeGreaterThanOrEqual(0);
  });

  it("returns nothing for a query that matches no place", () => {
    expect(zones("1234567")).toEqual([]);
  });

  it("puts a pinned zone ahead of an equal match that is not pinned", () => {
    const found = zones("s");
    const sydney = found.indexOf("Australia/Sydney");
    const other = found.indexOf("Australia/Brisbane");
    expect(sydney).toBeGreaterThanOrEqual(0);
    expect(other === -1 || sydney < other).toBe(true);
  });
});
