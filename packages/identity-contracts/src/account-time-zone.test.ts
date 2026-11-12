import { describe, expect, it } from "vitest";
import {
  accountPlaceZoneSchema,
  effectiveAccountTimeZone,
  parseAccountTimeZoneChange,
} from "./account-time-zone.js";

describe("accountPlaceZoneSchema", () => {
  it.each(["Europe/London", "America/New_York", "Australia/Sydney", "Asia/Kolkata"])(
    "accepts the place zone %s",
    (zone) => {
      expect(accountPlaceZoneSchema.safeParse(zone).success).toBe(true);
    },
  );

  it.each(["UTC", "GMT", "Etc/GMT+5", "Etc/UTC", "Mars/Olympus", "London", "", " Europe/London"])(
    "refuses %j, which names no real place",
    (zone) => {
      expect(accountPlaceZoneSchema.safeParse(zone).success).toBe(false);
    },
  );

  it("refuses a value that is not text", () => {
    expect(accountPlaceZoneSchema.safeParse(null).success).toBe(false);
    expect(accountPlaceZoneSchema.safeParse(42).success).toBe(false);
  });
});

describe("parseAccountTimeZoneChange", () => {
  it("reads always-use-one-city as fixed", () => {
    expect(parseAccountTimeZoneChange({ mode: "fixed", zone: "Asia/Tokyo" })).toEqual({
      mode: "fixed",
      zone: "Asia/Tokyo",
    });
  });

  it("refuses a fixed choice without a real place", () => {
    for (const zone of [null, "", "UTC", "Etc/GMT-3", "Nowhere/City"]) {
      expect(parseAccountTimeZoneChange({ mode: "fixed", zone })).toBeNull();
    }
  });

  it("reads automatic with the device's zone", () => {
    expect(parseAccountTimeZoneChange({ mode: "automatic", zone: "Europe/Paris" })).toEqual({
      mode: "automatic",
      deviceZone: "Europe/Paris",
    });
  });

  it("reads automatic with an unusable device zone as no zone yet, not a refusal", () => {
    for (const zone of [null, "UTC", "Etc/UTC", "junk"]) {
      expect(parseAccountTimeZoneChange({ mode: "automatic", zone })).toEqual({
        mode: "automatic",
        deviceZone: null,
      });
    }
  });

  it("refuses an unknown or missing mode", () => {
    expect(parseAccountTimeZoneChange({ mode: "sometimes", zone: "Europe/Paris" })).toBeNull();
    expect(parseAccountTimeZoneChange({ mode: null, zone: "Europe/Paris" })).toBeNull();
  });
});

describe("effectiveAccountTimeZone", () => {
  it("is the stored zone, whichever mode", () => {
    expect(effectiveAccountTimeZone({ mode: "fixed", zone: "Asia/Tokyo" })).toBe("Asia/Tokyo");
    expect(effectiveAccountTimeZone({ mode: "automatic", zone: "Europe/Paris" })).toBe(
      "Europe/Paris",
    );
  });

  it("is nothing before a device has reported, or when the stored zone is not a place", () => {
    expect(effectiveAccountTimeZone({ mode: "automatic", zone: null })).toBeNull();
    expect(effectiveAccountTimeZone({ mode: "fixed", zone: "UTC" })).toBeNull();
  });
});
