import {
  gateShopAuthenticatedRoute,
  shopStorefrontLoginHref,
  toShopViewerState,
} from "@/lib/shop-viewer-state";
import { describe, expect, it } from "vitest";

const destinations = {
  loginHref: "https://identity.test/login",
  registerHref: "/register",
  accountHref: "/account",
  logoutHref: "https://identity.test/logout",
  disabledAccountHref: "/account/disabled",
};

describe("toShopViewerState", () => {
  it("maps guest session", () => {
    expect(
      toShopViewerState({ sessionLookupOk: true, payload: { authenticated: false } }, destinations),
    ).toEqual({
      kind: "guest",
      loginHref: destinations.loginHref,
      registerHref: destinations.registerHref,
    });
  });

  it("maps authenticated session", () => {
    expect(
      toShopViewerState(
        {
          sessionLookupOk: true,
          payload: {
            authenticated: true,
            profile: { email: "a@example.com", name: "Alex" },
          },
        },
        destinations,
      ),
    ).toMatchObject({ kind: "authenticated", email: "a@example.com" });
  });

  it("maps disabled identity", () => {
    expect(
      toShopViewerState(
        {
          sessionLookupOk: true,
          payload: { authenticated: false, reason: "identity_disabled" },
        },
        destinations,
      ),
    ).toEqual({
      kind: "disabled",
      message: expect.any(String),
      accountHref: "/account/disabled",
    });
  });

  it("maps unavailable BFF", () => {
    expect(toShopViewerState({ sessionLookupOk: false, payload: null }, destinations)).toEqual({
      kind: "unavailable",
      message: expect.any(String),
    });
  });
});

describe("gateShopAuthenticatedRoute", () => {
  it("allows authenticated viewers", () => {
    expect(
      gateShopAuthenticatedRoute(
        {
          kind: "authenticated",
          displayName: "Alex",
          email: "a@example.com",
          accountHref: "/account",
          logoutHref: "/logout",
        },
        "/checkout",
      ),
    ).toEqual({ allowed: true });
  });

  it("redirects guests through storefront login with returnTo", () => {
    const outcome = gateShopAuthenticatedRoute(
      { kind: "guest", loginHref: "x", registerHref: "/register" },
      "/checkout",
    );
    expect(outcome).toEqual({
      allowed: false,
      redirectTo: shopStorefrontLoginHref("/checkout"),
    });
  });

  it("redirects disabled viewers to account status", () => {
    expect(
      gateShopAuthenticatedRoute(
        {
          kind: "disabled",
          message: "Restricted",
          accountHref: "/account/disabled",
        },
        "/checkout",
      ),
    ).toEqual({ allowed: false, redirectTo: "/account/disabled" });
  });

  it("blocks unavailable viewers without redirect", () => {
    expect(
      gateShopAuthenticatedRoute(
        { kind: "unavailable", message: "Identity unavailable" },
        "/checkout",
      ),
    ).toEqual({ allowed: false, redirectTo: "" });
  });
});
