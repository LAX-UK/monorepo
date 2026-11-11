process.env.TZ = "Europe/London";

import { describe, expect, it } from "vitest";
import {
  deviceZoneOffer,
  shouldReportDeviceZone,
  timeZoneSummary,
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

describe("timeZoneSummary", () => {
  it("names the zone in use and its source for Automatic", () => {
    expect(timeZoneSummary({ mode: "automatic", zone: "Africa/Cairo" }, null, WINTER)).toEqual({
      value: "Automatic · Cairo (GMT+2)",
      detail: "Taken from this device. Sale times stay in London time, with yours next to them.",
    });
  });

  it("says what happens next when the device has not reported yet", () => {
    expect(timeZoneSummary({ mode: "automatic", zone: null }, null, WINTER)).toEqual({
      value: "Automatic",
      detail: "We’ll use this device’s time zone the next time you visit.",
    });
  });

  it("shows a fixed city alone when the device is there too, or unknown", () => {
    const fixed = { mode: "fixed", zone: "America/New_York" } as const;
    expect(timeZoneSummary(fixed, "America/New_York", WINTER)).toEqual({
      value: "New York (GMT−5)",
      detail: null,
    });
    expect(timeZoneSummary(fixed, null, WINTER).detail).toBeNull();
  });

  it("notes a device somewhere else without asking for anything", () => {
    expect(
      timeZoneSummary({ mode: "fixed", zone: "America/New_York" }, "Asia/Dubai", WINTER),
    ).toEqual({
      value: "New York (GMT−5)",
      detail: "This device is on Dubai time. We still use New York, as you chose.",
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
