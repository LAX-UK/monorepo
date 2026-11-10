import { describe, expect, it } from "vitest";
import {
  chosenZoneCookieValue,
  decodeViewerZone,
  encodeViewerZone,
  parseViewerZoneCookie,
  resolveViewerZone,
} from "./viewer-zone.js";

describe("parseViewerZoneCookie", () => {
  it("reads the zone the device reported", () => {
    expect(parseViewerZoneCookie("Africa/Cairo")).toEqual({
      zone: "Africa/Cairo",
      source: "device",
    });
  });

  it("reads a zone the visitor chose", () => {
    expect(parseViewerZoneCookie(chosenZoneCookieValue("Australia/Sydney"))).toEqual({
      zone: "Australia/Sydney",
      source: "chosen",
    });
  });

  it("reads a URL-encoded value", () => {
    expect(parseViewerZoneCookie("fixed%3AAmerica%2FNew_York")).toEqual({
      zone: "America/New_York",
      source: "chosen",
    });
  });

  it.each([
    null,
    undefined,
    "",
    "UTC",
    "GMT",
    "Etc/GMT+5",
    "Etc/UTC",
    "Mars/Olympus_Mons",
    "fixed:UTC",
    "%E0%A4%A",
  ])("treats %j as no zone", (raw) => {
    expect(parseViewerZoneCookie(raw)).toBeNull();
  });
});

describe("resolveViewerZone", () => {
  it("prefers LAX Account over the cookie", () => {
    expect(resolveViewerZone({ account: "America/New_York", cookie: "Africa/Cairo" })).toEqual({
      zone: "America/New_York",
      source: "account",
    });
  });

  it("falls back to the cookie when Account has no usable zone", () => {
    expect(resolveViewerZone({ account: null, cookie: "Africa/Cairo" })).toEqual({
      zone: "Africa/Cairo",
      source: "device",
    });
    expect(resolveViewerZone({ account: "UTC", cookie: "Africa/Cairo" })?.source).toBe("device");
  });

  it("is unknown with neither", () => {
    expect(resolveViewerZone({ account: null, cookie: undefined })).toBeNull();
  });
});

describe("the snapshot", () => {
  it("round-trips a zone and the no-zone case", () => {
    const value = { zone: "Asia/Dubai", source: "chosen" } as const;
    expect(decodeViewerZone(encodeViewerZone(value))).toEqual(value);
    expect(decodeViewerZone(encodeViewerZone(null))).toBeNull();
  });
});
