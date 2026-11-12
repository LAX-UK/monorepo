import { describe, expect, it } from "vitest";
import { cityName } from "./city.js";
import { isKnownZone, isPlaceholderZone, isValidZone, normaliseViewerZone } from "./zone.js";

describe("zone validation", () => {
  it.each([
    "Europe/London",
    "Europe/Dublin",
    "Europe/Lisbon",
    "Africa/Cairo",
    "America/New_York",
    "Asia/Kolkata",
    "Asia/Kathmandu",
    "Pacific/Chatham",
    "Australia/Lord_Howe",
    "Australia/Sydney",
    "Pacific/Honolulu",
    "Pacific/Kiritimati",
    "Asia/Calcutta",
  ])("accepts %s", (zone) => {
    expect(isValidZone(zone)).toBe(true);
    expect(normaliseViewerZone(zone)).toBe(zone);
  });

  it.each(["Mars/Olympus_Mons", "London", "", "+05:00", null, undefined, 42])(
    "rejects %j",
    (zone) => {
      expect(isValidZone(zone)).toBe(false);
      expect(normaliseViewerZone(zone)).toBeNull();
    },
  );

  it.each(["UTC", "GMT", "Etc/UTC", "Etc/GMT+5", "Etc/GMT-14"])(
    "treats %s as no place for a viewer",
    (zone) => {
      expect(isPlaceholderZone(zone)).toBe(true);
      expect(normaliseViewerZone(zone)).toBeNull();
    },
  );

  it("does not mistake a real place for a placeholder", () => {
    expect(isPlaceholderZone("Europe/London")).toBe(false);
    expect(isPlaceholderZone("Atlantic/Reykjavik")).toBe(false);
  });
});

describe("cityName", () => {
  it.each([
    ["America/New_York", "New York"],
    ["Australia/Lord_Howe", "Lord Howe"],
    ["America/Argentina/Buenos_Aires", "Buenos Aires"],
    ["Africa/Cairo", "Cairo"],
  ])("%s -> %s", (zone, city) => {
    expect(cityName(zone)).toBe(city);
  });
});

describe("isKnownZone", () => {
  it("accepts every zone the runtime can compute with, including UTC", () => {
    expect(isKnownZone("Europe/London")).toBe(true);
    expect(isKnownZone("UTC")).toBe(true);
    expect(isKnownZone("Etc/GMT+5")).toBe(true);
  });

  it("rejects what it cannot", () => {
    expect(isKnownZone("Not/AZone")).toBe(false);
    expect(isKnownZone("")).toBe(false);
    expect(isKnownZone(undefined)).toBe(false);
  });
});
