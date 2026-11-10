import { buildViewerZoneScript } from "@auction/datetime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = new Date("2026-11-10T12:00:00Z");

function run(snippet = buildViewerZoneScript()) {
  // biome-ignore lint/security/noGlobalEval: controlled harness for the inline head script
  eval(snippet);
}

function deviceIn(zone: string | undefined) {
  const real = Intl.DateTimeFormat;
  vi.spyOn(Intl, "DateTimeFormat").mockImplementation(function (
    this: unknown,
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ) {
    const format = new real(locales, options);
    if (!options?.timeZone) {
      const resolved = format.resolvedOptions();
      return Object.assign(format, { resolvedOptions: () => ({ ...resolved, timeZone: zone }) });
    }
    return format;
  } as unknown as typeof Intl.DateTimeFormat);
}

function clearCookies() {
  for (const part of document.cookie.split(";")) {
    const name = part.split("=")[0]?.trim();
    if (name) document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
  }
}

describe("the viewer-zone head script", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    document.documentElement.className = "";
    clearCookies();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearCookies();
  });

  it("stores the device zone and marks a visitor on another clock", () => {
    deviceIn("Africa/Cairo");
    run();
    expect(document.cookie).toContain("lax_tz=Africa%2FCairo");
    expect(document.documentElement.classList.contains("tz-away")).toBe(true);
  });

  it("marks nothing for a visitor on London's clock", () => {
    deviceIn("Europe/London");
    run();
    expect(document.cookie).toContain("lax_tz=Europe%2FLondon");
    expect(document.documentElement.classList.contains("tz-away")).toBe(false);
  });

  it("treats Dublin like London in winter, and Paris as away", () => {
    deviceIn("Europe/Dublin");
    run();
    expect(document.documentElement.classList.contains("tz-away")).toBe(false);
    vi.restoreAllMocks();
    deviceIn("Europe/Paris");
    run();
    expect(document.documentElement.classList.contains("tz-away")).toBe(true);
  });

  it("does not rewrite a cookie that already matches", () => {
    document.cookie = "lax_tz=Africa%2FCairo; path=/";
    deviceIn("Africa/Cairo");
    const set = vi.spyOn(document, "cookie", "set");
    run();
    expect(set).not.toHaveBeenCalled();
  });

  it("rewrites the cookie when the device moved", () => {
    document.cookie = "lax_tz=Africa%2FCairo; path=/";
    deviceIn("Asia/Dubai");
    run();
    expect(document.cookie).toContain("lax_tz=Asia%2FDubai");
  });

  it("never overwrites a zone the visitor chose, and holds the row for that zone", () => {
    document.cookie = `lax_tz=${encodeURIComponent("fixed:Australia/Sydney")}; path=/`;
    deviceIn("Europe/London");
    run();
    expect(decodeURIComponent(document.cookie)).toContain("lax_tz=fixed:Australia/Sydney");
    expect(document.documentElement.classList.contains("tz-away")).toBe(true);
  });

  it.each(["UTC", "GMT", "Etc/GMT+5", "Etc/UTC", undefined])(
    "stores nothing and marks nothing for the placeholder zone %s",
    (zone) => {
      deviceIn(zone);
      run();
      expect(document.cookie).toBe("");
      expect(document.documentElement.classList.contains("tz-away")).toBe(false);
    },
  );

  it("expires a stale device cookie when the device no longer reports a usable zone", () => {
    document.cookie = "lax_tz=Africa%2FCairo; path=/";
    deviceIn("UTC");
    run();
    expect(document.cookie).toBe("");
    expect(document.documentElement.classList.contains("tz-away")).toBe(false);
  });

  it("keeps a zone the visitor chose even when the device reports nothing usable", () => {
    document.cookie = "lax_tz=fixed%3AAustralia%2FSydney; path=/";
    deviceIn(undefined);
    run();
    expect(decodeURIComponent(document.cookie)).toBe("lax_tz=fixed:Australia/Sydney");
    expect(document.documentElement.classList.contains("tz-away")).toBe(true);
  });

  it("never throws, whatever the browser does", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => run()).not.toThrow();
    expect(document.documentElement.classList.contains("tz-away")).toBe(false);
  });
});
