import type { ShopViewerState } from "@/lib/shop-viewer-state";
import { describe, expect, it } from "vitest";
import {
  resolveRetiredShopAccountRedirect,
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

describe("resolveRetiredShopAccountRedirect", () => {
  const art = new URL("https://art.example.test");

  it("redirects retired account pages, with or without a trailing slash", () => {
    expect(resolveRetiredShopAccountRedirect("/account/collection", art)).toMatch(
      /\/account\/portfolio$/,
    );
    expect(resolveRetiredShopAccountRedirect("/account/documents/", art)).toMatch(
      /\/account\/portfolio$/,
    );
    expect(resolveRetiredShopAccountRedirect("/account/editions", art)).toMatch(
      /\/account\/portfolio\?product=shop$/,
    );
    expect(resolveRetiredShopAccountRedirect("/account/enquiries", art)).toBe(
      "https://art.example.test/account/enquiries",
    );
  });

  it("sends the seller tools to LAX Account's Selling area", () => {
    const cases: Array<[string, string]> = [
      ["/account/sale-limits", "/account/selling/editions"],
      ["/account/sales", "/account/selling/sales"],
      ["/account/payouts/", "/account/selling/payouts"],
      ["/account/artworks", "/account/selling/artworks"],
      ["/account/artist-sales", "/account/selling/artworks"],
    ];
    for (const [from, to] of cases) {
      expect(resolveRetiredShopAccountRedirect(from, art)).toBe(`http://localhost:3040${to}`);
    }
  });

  it("leaves every other path alone", () => {
    expect(resolveRetiredShopAccountRedirect("/account/orders", art)).toBeNull();
    expect(resolveRetiredShopAccountRedirect("/account/collection/x", art)).toBeNull();
    expect(resolveRetiredShopAccountRedirect("/account", art)).toBeNull();
    expect(resolveRetiredShopAccountRedirect("/account/sales/x", art)).toBeNull();
    expect(resolveRetiredShopAccountRedirect("/account/salesroom", art)).toBeNull();
  });
});
