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
  it("orders products, Bid-hosted policies, then shop links with the account entry", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [bid],
      accountState: { kind: "guest" },
    });
    expect(vm.columns.map((column) => column.id)).toEqual(["lax-products", "policies", "shop"]);
    expect(vm.columns[1]?.links).toEqual([
      { label: "Privacy notice", href: "https://bid.example/privacy" },
      { label: "Cookie policy", href: "https://bid.example/cookies" },
    ]);
    expect(vm.columns[2]?.links.at(-1)).toEqual({ label: "Join us", href: "/register" });
  });

  it("omits product and policy columns without cross-product links", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "disabled", accountHref: "/account/disabled" },
    });
    expect(vm.columns.map((column) => column.id)).toEqual(["shop"]);
    expect(vm.columns[0]?.links.at(-1)).toEqual({
      label: "Account status",
      href: "/account/disabled",
    });
  });

  it("shows a non-link note when sign-in status is unavailable", () => {
    const shop = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "unavailable" },
    }).columns[0];
    expect(shop?.links.map((link) => link.label)).toEqual(["Artworks", "Artists", "Categories"]);
    expect(shop?.note).toBe("Sign-in status unavailable");
  });
});
