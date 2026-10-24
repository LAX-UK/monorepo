import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import { describe, expect, it } from "vitest";
import { buildShopFooterVm } from "./shop-footer.vm.js";

const bid: LaxProductLinkVm = {
  id: "bid",
  label: "LAX Bid",
  href: "https://bid.example/",
  current: false,
  external: true,
};

describe("buildShopFooterVm", () => {
  it("orders shop, account, products, then Bid-hosted legal documents", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [bid],
      accountState: { kind: "guest" },
    });
    expect(vm.columns.map((column) => column.id)).toEqual([
      "shop",
      "account",
      "lax-products",
      "legal",
    ]);
    expect(vm.columns[1]?.links).toEqual([
      { label: "Sign in", href: "/login" },
      { label: "Create account", href: "/register" },
    ]);
    expect(vm.columns[3]?.links).toEqual([
      { label: "Conditions of business", href: "https://bid.example/terms" },
      { label: "Privacy notice", href: "https://bid.example/privacy" },
      { label: "Cookie policy", href: "https://bid.example/cookies" },
      { label: "Shipping & logistics", href: "https://bid.example/shipping" },
    ]);
  });

  it("omits product and legal columns without cross-product links", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "disabled", accountHref: "/account/disabled" },
    });
    expect(vm.columns.map((column) => column.id)).toEqual(["shop", "account"]);
    expect(vm.columns[1]?.links).toEqual([{ label: "Account status", href: "/account/disabled" }]);
  });

  it("links signed-in buyers to their orders and LAX Account, with no collection link", () => {
    const account = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "authenticated" },
    }).columns[1];
    expect(account?.links).toEqual([
      { label: "Your orders", href: "/account/orders" },
      { label: "LAX Account", href: "http://localhost:3040/account" },
    ]);
  });

  it("shows a non-link note when sign-in status is unavailable", () => {
    const account = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "unavailable" },
    }).columns[1];
    expect(account?.links).toEqual([]);
    expect(account?.note).toBe("Sign-in status unavailable");
  });
});
