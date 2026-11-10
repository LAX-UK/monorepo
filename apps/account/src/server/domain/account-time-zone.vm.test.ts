process.env.TZ = "Europe/London";

import { describe, expect, it } from "vitest";
import {
  deviceZoneOffer,
  shouldReportDeviceZone,
  toTimeZonePreferenceVm,
  zoneLabel,
} from "./account-time-zone.vm";

const WINTER = new Date("2026-11-12T12:00:00Z");

describe("zoneLabel", () => {
  it("names the city and its offset on the day", () => {
    expect(zoneLabel("Australia/Sydney", WINTER)).toBe("Sydney (GMT+11)");
    expect(zoneLabel("Europe/London", WINTER)).toBe("London (GMT)");
  });
});

describe("toTimeZonePreferenceVm", () => {
  it("keeps a fixed city", () => {
    expect(toTimeZonePreferenceVm({ mode: "fixed", zone: "Asia/Tokyo" })).toEqual({
      mode: "fixed",
      zone: "Asia/Tokyo",
    });
  });

  it("keeps automatic with the zone the device last reported, or none yet", () => {
    expect(toTimeZonePreferenceVm({ mode: "automatic", zone: "Europe/Paris" })).toEqual({
      mode: "automatic",
      zone: "Europe/Paris",
    });
    expect(toTimeZonePreferenceVm({ mode: "automatic", zone: null })).toEqual({
      mode: "automatic",
      zone: null,
    });
  });

  it("never lets a zone that names no place reach a formatter", () => {
    expect(toTimeZonePreferenceVm({ mode: "fixed", zone: "UTC" })).toEqual({
      mode: "automatic",
      zone: null,
    });
    expect(toTimeZonePreferenceVm({ mode: "automatic", zone: "Etc/GMT+5" })).toEqual({
      mode: "automatic",
      zone: null,
    });
  });
});

describe("deviceZoneOffer", () => {
  const fixed = { mode: "fixed", zone: "Europe/London" } as const;

  it("offers the switch when the device is somewhere else than the fixed city", () => {
    expect(deviceZoneOffer(fixed, "Asia/Tokyo")).toEqual({
      deviceZone: "Asia/Tokyo",
      fixedZone: "Europe/London",
    });
  });

  it("offers nothing when the device is in the fixed city", () => {
    expect(deviceZoneOffer(fixed, "Europe/London")).toBeNull();
  });

  it("offers nothing when the device's zone is unknown", () => {
    expect(deviceZoneOffer(fixed, null)).toBeNull();
  });

  it("offers nothing to a person who already follows their device", () => {
    expect(deviceZoneOffer({ mode: "automatic", zone: "Europe/London" }, "Asia/Tokyo")).toBeNull();
  });
});

describe("shouldReportDeviceZone", () => {
  it("stores the device's zone while following the device and it differs", () => {
    expect(shouldReportDeviceZone({ mode: "automatic", zone: "Europe/London" }, "Asia/Tokyo")).toBe(
      true,
    );
    expect(shouldReportDeviceZone({ mode: "automatic", zone: null }, "Asia/Tokyo")).toBe(true);
  });

  it("does not store the same zone again or an unknown one", () => {
    expect(shouldReportDeviceZone({ mode: "automatic", zone: "Asia/Tokyo" }, "Asia/Tokyo")).toBe(
      false,
    );
    expect(shouldReportDeviceZone({ mode: "automatic", zone: "Asia/Tokyo" }, null)).toBe(false);
  });

  it("never stores over a fixed city", () => {
    expect(shouldReportDeviceZone({ mode: "fixed", zone: "Europe/London" }, "Asia/Tokyo")).toBe(
      false,
    );
  });
});
