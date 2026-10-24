import type { ShopViewerState } from "@/lib/shop-viewer-state";
import { describe, expect, it } from "vitest";
import {
  resolveShopAccountEntryRedirect,
  retiredShopAccountPageDestination,
} from "./shop-account-routes";

const signedIn: ShopViewerState = {
  kind: "authenticated",
  displayName: "Alex",
  email: "alex@example.test",
  accountHref: "/account",
  logoutHref: "https://identity.test/logout",
};

describe("retiredShopAccountPageDestination", () => {
  it("sends collection and documents to the LAX Account portfolio", () => {
    expect(retiredShopAccountPageDestination("collection", null)).toBe(
      "http://localhost:3040/account/portfolio",
    );
    expect(retiredShopAccountPageDestination("documents", null)).toBe(
      "http://localhost:3040/account/portfolio",
    );
  });

  it("sends editions to the portfolio filtered to LAX Shop", () => {
    expect(retiredShopAccountPageDestination("editions", null)).toBe(
      "http://localhost:3040/account/portfolio?product=shop",
    );
  });

  it("sends enquiries to lax.art, or back to orders when lax.art is not configured", () => {
    expect(retiredShopAccountPageDestination("enquiries", "https://lax.art/")).toBe(
      "https://lax.art/account/enquiries",
    );
    expect(retiredShopAccountPageDestination("enquiries", null)).toBe("/account/orders");
  });
});

describe("resolveShopAccountEntryRedirect", () => {
  it("runs the basket merge first, then continues to the orders page", () => {
    expect(resolveShopAccountEntryRedirect(signedIn, {})).toBe(
      "/account/post-sign-in?returnTo=%2Faccount%2Forders",
    );
  });

  it("goes to the orders page once the merge has run, keeping the outcome for the notice", () => {
    expect(resolveShopAccountEntryRedirect(signedIn, { basketMerge: "merged" })).toBe(
      "/account/orders?basketMerge=merged",
    );
    expect(resolveShopAccountEntryRedirect(signedIn, { merged: "1" })).toBe("/account/orders");
  });

  it("honours a safe return path and ignores an unsafe one", () => {
    expect(
      resolveShopAccountEntryRedirect(signedIn, { returnTo: "/basket", basketMerge: "skipped" }),
    ).toBe("/basket?basketMerge=skipped");
    expect(
      resolveShopAccountEntryRedirect(signedIn, {
        returnTo: "https://evil.example/",
        basketMerge: "skipped",
      }),
    ).toBe("/account/orders?basketMerge=skipped");
  });

  it("sends guests to sign in and disabled accounts to their notice", () => {
    expect(
      resolveShopAccountEntryRedirect(
        { kind: "guest", loginHref: "/login", registerHref: "/register" },
        {},
      ),
    ).toBe("/login?returnTo=%2Faccount%2Forders");
    expect(resolveShopAccountEntryRedirect({ kind: "disabled", message: "Disabled" }, {})).toBe(
      "/account/disabled",
    );
  });

  it("lets the orders page explain an unavailable sign-in check", () => {
    expect(
      resolveShopAccountEntryRedirect({ kind: "unavailable", message: "Unavailable" }, {}),
    ).toBe("/account/orders");
  });
});
