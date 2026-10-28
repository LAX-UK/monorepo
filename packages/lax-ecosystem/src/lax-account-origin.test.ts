import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAX_ACCOUNT_ORIGIN,
  LOCAL_LAX_ACCOUNT_ORIGIN,
  laxAccountPageUrl,
  resolveLaxAccountOrigin,
} from "./lax-account-origin.js";

describe("resolveLaxAccountOrigin", () => {
  it("uses the configured origin without a trailing slash", () => {
    expect(resolveLaxAccountOrigin(" https://test-account.lax.bid/ ", "production")).toBe(
      "https://test-account.lax.bid",
    );
  });

  it("falls back to the dev server outside production and the live portal in production", () => {
    expect(resolveLaxAccountOrigin(undefined, "development")).toBe(LOCAL_LAX_ACCOUNT_ORIGIN);
    expect(resolveLaxAccountOrigin("", "test")).toBe(LOCAL_LAX_ACCOUNT_ORIGIN);
    expect(resolveLaxAccountOrigin(undefined, "production")).toBe(DEFAULT_LAX_ACCOUNT_ORIGIN);
  });
});

describe("laxAccountPageUrl", () => {
  it("joins the origin and the page path", () => {
    const origin = "https://account.lax.bid";
    expect(laxAccountPageUrl(origin, "portfolio")).toBe(`${origin}/account/portfolio`);
    expect(laxAccountPageUrl(origin, "sellingPayouts")).toBe(`${origin}/account/selling/payouts`);
  });
});
