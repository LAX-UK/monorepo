import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAX_ACCOUNT_ORIGIN,
  LOCAL_LAX_ACCOUNT_ORIGIN,
  laxAccountHomeUrl,
  laxAccountUrl,
  resolveLaxAccountOrigin,
} from "./lax-account-url";

describe("resolveLaxAccountOrigin", () => {
  it("uses the configured origin, trimmed and without a trailing slash", () => {
    expect(resolveLaxAccountOrigin(" https://test-account.lax.bid/ ", "production")).toBe(
      "https://test-account.lax.bid",
    );
  });

  it("falls back to the local Account dev server outside production", () => {
    expect(resolveLaxAccountOrigin(undefined, "development")).toBe(LOCAL_LAX_ACCOUNT_ORIGIN);
    expect(resolveLaxAccountOrigin("", "test")).toBe(LOCAL_LAX_ACCOUNT_ORIGIN);
  });

  it("falls back to the live portal in a production build", () => {
    expect(resolveLaxAccountOrigin(undefined, "production")).toBe(DEFAULT_LAX_ACCOUNT_ORIGIN);
    expect(resolveLaxAccountOrigin("  ", "production")).toBe(DEFAULT_LAX_ACCOUNT_ORIGIN);
  });
});

describe("laxAccountUrl", () => {
  it("joins a path to the origin with exactly one slash", () => {
    expect(laxAccountUrl("/account/security")).toBe(`${LOCAL_LAX_ACCOUNT_ORIGIN}/account/security`);
    expect(laxAccountUrl("account/profile")).toBe(`${LOCAL_LAX_ACCOUNT_ORIGIN}/account/profile`);
  });

  it("opens the Account front door with a way back to Bid", () => {
    expect(laxAccountHomeUrl()).toBe(`${LOCAL_LAX_ACCOUNT_ORIGIN}/account?from=bid`);
  });
});
