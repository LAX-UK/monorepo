import { describe, expect, it } from "vitest";
import { type AccountTimeZonePort, loadViewerZone } from "./viewer-zone.server";

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
