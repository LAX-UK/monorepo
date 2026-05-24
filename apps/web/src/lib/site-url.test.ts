import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
  const originalSite = process.env.NEXT_PUBLIC_SITE_URL;
  const originalWeb = process.env.NEXT_PUBLIC_WEB_ORIGIN;

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalSite === undefined) Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SITE_URL");
    else process.env.NEXT_PUBLIC_SITE_URL = originalSite;
    if (originalWeb === undefined) Reflect.deleteProperty(process.env, "NEXT_PUBLIC_WEB_ORIGIN");
    else process.env.NEXT_PUBLIC_WEB_ORIGIN = originalWeb;
  });

  it("uses window.location.origin in the browser", () => {
    vi.stubGlobal("window", { location: { origin: "https://test.lax.bid" } });
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SITE_URL");
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_WEB_ORIGIN");
    expect(getSiteUrl()).toBe("https://test.lax.bid");
  });

  it("prefers NEXT_PUBLIC_SITE_URL on the server", () => {
    vi.stubGlobal("window", undefined);
    process.env.NEXT_PUBLIC_SITE_URL = "https://lax.bid/";
    process.env.NEXT_PUBLIC_WEB_ORIGIN = "https://wrong.example";
    expect(getSiteUrl()).toBe("https://lax.bid");
  });

  it("falls back to NEXT_PUBLIC_WEB_ORIGIN on the server", () => {
    vi.stubGlobal("window", undefined);
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SITE_URL");
    process.env.NEXT_PUBLIC_WEB_ORIGIN = "https://test.lax.bid/";
    expect(getSiteUrl()).toBe("https://test.lax.bid");
  });

  it("defaults to localhost in dev when unset", () => {
    vi.stubGlobal("window", undefined);
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_SITE_URL");
    Reflect.deleteProperty(process.env, "NEXT_PUBLIC_WEB_ORIGIN");
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
