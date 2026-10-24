import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAX_ACCOUNT_ORIGIN,
  LAX_ACCOUNT_PATHS,
  LOCAL_LAX_ACCOUNT_ORIGIN,
  laxAccountUrl,
  resolveLaxAccountOrigin,
} from "./lax-account-url";

describe("resolveLaxAccountOrigin", () => {
  it("uses the configured origin without a trailing slash", () => {
    expect(resolveLaxAccountOrigin(" https://test-account.lax.bid/ ", "production")).toBe(
      "https://test-account.lax.bid",
    );
  });

  it("falls back to the Account dev server outside production", () => {
    expect(resolveLaxAccountOrigin(undefined, "development")).toBe(LOCAL_LAX_ACCOUNT_ORIGIN);
    expect(resolveLaxAccountOrigin("", "test")).toBe(LOCAL_LAX_ACCOUNT_ORIGIN);
  });

  it("falls back to the live portal in a production build", () => {
    expect(resolveLaxAccountOrigin(undefined, "production")).toBe(DEFAULT_LAX_ACCOUNT_ORIGIN);
  });
});

describe("laxAccountUrl", () => {
  it("joins a path to the origin with one slash", () => {
    expect(laxAccountUrl(LAX_ACCOUNT_PATHS.portfolio)).toBe(
      `${LOCAL_LAX_ACCOUNT_ORIGIN}/account/portfolio`,
    );
    expect(laxAccountUrl("account/profile")).toBe(`${LOCAL_LAX_ACCOUNT_ORIGIN}/account/profile`);
  });
});
