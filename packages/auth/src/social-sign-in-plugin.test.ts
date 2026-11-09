import { describe, expect, it } from "vitest";
import { isSocialSessionPath } from "./auth-hooks/session-hooks.js";
import { isSocialCallbackPath, refusalUrl } from "./social-sign-in-plugin.js";

describe("isSocialCallbackPath", () => {
  it("is the provider's way back only", () => {
    expect(isSocialCallbackPath("/callback/:id")).toBe(true);
    expect(isSocialCallbackPath("/callback/google")).toBe(true);
    expect(isSocialCallbackPath("/sign-in/social")).toBe(false);
    expect(isSocialCallbackPath("/sign-in/email")).toBe(false);
    expect(isSocialCallbackPath(undefined)).toBe(false);
  });
});

describe("isSocialSessionPath", () => {
  it("covers the callback and an ID-token sign-in, not a password sign-in", () => {
    expect(isSocialSessionPath("/callback/:id")).toBe(true);
    expect(isSocialSessionPath("/sign-in/social")).toBe(true);
    expect(isSocialSessionPath("/sign-in/email")).toBe(false);
    expect(isSocialSessionPath("/magic-link/verify")).toBe(false);
    expect(isSocialSessionPath(undefined)).toBe(false);
  });
});

describe("refusalUrl", () => {
  const base = "https://auth.lax.bid";

  it("returns to the sign-in page that started the round trip, keeping its query", () => {
    const url = new URL(
      refusalUrl({
        errorUrl: "https://auth.lax.bid/login?client_id=lax-shop-web&next=%2Fbasket",
        callbackUrl: "https://auth.lax.bid/login?client_id=other",
        baseUrl: base,
        code: "account_not_linked",
      }),
    );
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("client_id")).toBe("lax-shop-web");
    expect(url.searchParams.get("next")).toBe("/basket");
    expect(url.searchParams.get("error")).toBe("account_not_linked");
  });

  it("falls back to the callback address, then to the issuer's error page", () => {
    expect(
      new URL(
        refusalUrl({
          errorUrl: undefined,
          callbackUrl: "https://auth.lax.bid/login?client_id=lax-bid-web",
          baseUrl: base,
          code: "staff_social_sign_in_not_allowed",
        }),
      ).searchParams.get("client_id"),
    ).toBe("lax-bid-web");
    expect(
      refusalUrl({ errorUrl: undefined, callbackUrl: undefined, baseUrl: base, code: "x" }),
    ).toBe("https://auth.lax.bid/error?error=x");
  });

  it("replaces an error already on the address instead of adding a second", () => {
    const url = new URL(
      refusalUrl({
        errorUrl: "https://auth.lax.bid/login?error=old&error_description=old",
        callbackUrl: undefined,
        baseUrl: base,
        code: "account_not_linked",
      }),
    );
    expect(url.searchParams.getAll("error")).toEqual(["account_not_linked"]);
    expect(url.searchParams.get("error_description")).toBeNull();
  });
});
