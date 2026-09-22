import { describe, expect, it } from "vitest";
import { isAllowedLaxProductUrl, normalizeProductBaseUrl } from "./safe-product-url.js";

describe("safe-product-url", () => {
  it("accepts https origins without path", () => {
    expect(isAllowedLaxProductUrl("https://lax.bid")).toBe(true);
    expect(isAllowedLaxProductUrl("https://shop.lax.art/")).toBe(true);
  });

  it("accepts localhost http in dev", () => {
    expect(isAllowedLaxProductUrl("http://localhost:3000")).toBe(true);
    expect(isAllowedLaxProductUrl("http://127.0.0.1:3020")).toBe(true);
  });

  it("rejects paths, credentials, and non-https public hosts", () => {
    expect(isAllowedLaxProductUrl("https://lax.bid/dashboard")).toBe(false);
    expect(isAllowedLaxProductUrl("https://user:pass@lax.bid")).toBe(false);
    expect(isAllowedLaxProductUrl("http://lax.bid")).toBe(false);
  });

  it("normalizes trailing slashes", () => {
    expect(normalizeProductBaseUrl("https://lax.bid/")).toBe("https://lax.bid");
  });
});
