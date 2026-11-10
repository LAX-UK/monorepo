import { describe, expect, it } from "vitest";
import {
  listZoneChoices,
  timesAreInLabel,
  zoneAbbreviations,
  zoneChoiceLabel,
} from "./zone-choices.js";

const WINTER = new Date("2026-11-12T12:00:00Z");
const SUMMER = new Date("2026-07-12T12:00:00Z");

describe("zoneChoiceLabel", () => {
  it("names the city and the short name at that moment", () => {
    expect(zoneChoiceLabel("Europe/London", WINTER)).toBe("London (GMT)");
    expect(zoneChoiceLabel("Europe/London", SUMMER)).toBe("London (BST)");
    expect(zoneChoiceLabel("America/New_York", WINTER)).toBe("New York (GMT-5)");
    expect(zoneChoiceLabel("America/Argentina/Buenos_Aires", WINTER)).toContain("Buenos Aires");
  });
});

describe("zoneAbbreviations", () => {
  it.each([
    ["Europe/London", "GMT/BST"],
    ["Europe/Paris", "CET/CEST"],
    ["America/New_York", "GMT-5/GMT-4"],
    ["Australia/Sydney", "GMT+10/GMT+11"],
  ])("lists standard time first for %s", (zone, expected) => {
    expect(zoneAbbreviations(zone, WINTER)).toBe(expected);
    expect(zoneAbbreviations(zone, SUMMER)).toBe(expected);
  });

  it("gives one name to a zone that keeps its offset all year", () => {
    expect(zoneAbbreviations("Asia/Dubai", WINTER)).not.toContain("/");
  });
});

describe("timesAreInLabel", () => {
  it("reads as the staff label beside date inputs", () => {
    expect(timesAreInLabel("Europe/London", WINTER)).toBe("Times are in London time (GMT/BST)");
    expect(timesAreInLabel("Europe/Paris", SUMMER)).toBe("Times are in Paris time (CET/CEST)");
  });
});

describe("listZoneChoices", () => {
  const choices = listZoneChoices(WINTER);

  it("lists real places and keeps out UTC and the fixed Etc zones", () => {
    const zones = choices.map((choice) => choice.zone);
    expect(zones).toContain("Europe/London");
    expect(zones).toContain("Asia/Kolkata");
    expect(zones).not.toContain("UTC");
    expect(zones.some((zone) => zone.startsWith("Etc/"))).toBe(false);
  });

  it("offers the current spelling of renamed places", () => {
    const zones = choices.map((choice) => choice.zone);
    expect(zones).toContain("Asia/Kolkata");
    expect(zones).not.toContain("Asia/Calcutta");
  });

  it("is sorted by label and carries the region", () => {
    const labels = choices.map((choice) => choice.label);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b, "en-GB")));
    expect(choices.find((choice) => choice.zone === "Europe/London")).toEqual({
      zone: "Europe/London",
      label: "London (GMT)",
      region: "Europe",
    });
  });
});
