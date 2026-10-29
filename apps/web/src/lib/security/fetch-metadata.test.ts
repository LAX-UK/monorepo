import { describe, expect, it } from "vitest";
import { isPrefetchRequest, isSameOriginNavigation, isSameOriginWrite } from "./fetch-metadata";

const h = (values: Record<string, string>) => new Headers(values);

describe("isSameOriginNavigation", () => {
  it("allows links on this site and ones the person opened themselves", () => {
    expect(isSameOriginNavigation(h({ "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOriginNavigation(h({ "sec-fetch-site": "none" }))).toBe(true);
  });

  it("does not trust links from other sites, sibling subdomains or clients without metadata", () => {
    expect(isSameOriginNavigation(h({ "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(isSameOriginNavigation(h({ "sec-fetch-site": "same-site" }))).toBe(false);
    expect(isSameOriginNavigation(h({}))).toBe(false);
  });
});

describe("isSameOriginWrite", () => {
  const origin = "https://lax.bid";

  it("follows Sec-Fetch-Site when the browser sends it", () => {
    expect(isSameOriginWrite(h({ "sec-fetch-site": "same-origin" }), origin)).toBe(true);
    expect(isSameOriginWrite(h({ "sec-fetch-site": "same-site", origin }), origin)).toBe(false);
    expect(isSameOriginWrite(h({ "sec-fetch-site": "none" }), origin)).toBe(false);
  });

  it("falls back to Origin for older browsers", () => {
    expect(isSameOriginWrite(h({ origin }), origin)).toBe(true);
    expect(isSameOriginWrite(h({ origin: "https://evil.example" }), origin)).toBe(false);
    expect(isSameOriginWrite(h({}), origin)).toBe(false);
  });
});

describe("isPrefetchRequest", () => {
  it("recognises router and browser prefetches", () => {
    expect(isPrefetchRequest(h({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetchRequest(h({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetchRequest(h({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(h({ "sec-fetch-site": "same-origin" }))).toBe(false);
  });
});
