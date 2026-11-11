import { describe, expect, it } from "vitest";
import { type AccountTimeZonePort, accountTimeZoneFor, loadViewerZone } from "./viewer-zone.server";

function cookies(value?: string) {
  return { get: (name: string) => (name === "lax_tz" && value ? { value } : undefined) };
}

const account = (zone: string | null): AccountTimeZonePort => ({
  alwaysUseZone: async () => zone,
});

describe("loadViewerZone", () => {
  it("uses LAX Account 'Always use' first", async () => {
    expect(await loadViewerZone(cookies("Africa/Cairo"), account("America/New_York"))).toEqual({
      zone: "America/New_York",
      source: "account",
    });
  });

  it("then the lax_tz cookie", async () => {
    expect(await loadViewerZone(cookies("Africa/Cairo"), account(null))).toEqual({
      zone: "Africa/Cairo",
      source: "device",
    });
  });

  it("is unknown without either, before Account provides a port", async () => {
    expect(await loadViewerZone(cookies())).toBeNull();
  });

  it.each(["UTC", "Etc/GMT-3", "Not/AZone"])("treats %s as unknown", async (value) => {
    expect(await loadViewerZone(cookies(value))).toBeNull();
    expect(await loadViewerZone(cookies(), account(value))).toBeNull();
  });
});

describe("accountTimeZoneFor", () => {
  it("overrides the device only for a city the person fixed", async () => {
    const fixed = accountTimeZoneFor({ mode: "fixed", zone: "Australia/Sydney" });
    expect(await loadViewerZone(cookies("Africa/Cairo"), fixed)).toEqual({
      zone: "Australia/Sydney",
      source: "account",
    });
  });

  it("leaves the device in charge while the person follows it", async () => {
    const automatic = accountTimeZoneFor({ mode: "automatic", zone: "Asia/Tokyo" });
    expect(await loadViewerZone(cookies("Africa/Cairo"), automatic)).toEqual({
      zone: "Africa/Cairo",
      source: "device",
    });
  });

  it("knows nothing when signed out or the answer is missing", async () => {
    expect(await accountTimeZoneFor(undefined).alwaysUseZone()).toBeNull();
    expect(await accountTimeZoneFor({ mode: "fixed", zone: null }).alwaysUseZone()).toBeNull();
  });
});
