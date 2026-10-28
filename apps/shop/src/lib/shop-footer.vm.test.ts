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

const art: LaxProductLinkVm = {
  id: "art",
  label: "lax.art",
  href: "https://art.example/",
  current: false,
  external: true,
};

const ALL_POLICIES = ["terms", "delivery", "returns", "help", "privacy", "cookies"] as const;

describe("buildShopFooterVm", () => {
  it("leaves out policy pages that cannot be linked, such as drafts on production", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [bid],
      accountState: { kind: "guest" },
      linkablePolicies: ["terms"],
    });
    const hrefs = vm.columns.flatMap((column) => column.links.map((link) => link.href));
    expect(hrefs).toContain("/terms");
    for (const hidden of ["/delivery", "/returns", "/help", "/privacy", "/cookies"]) {
      expect(hrefs).not.toContain(hidden);
    }
    expect(vm.columns.find((column) => column.id === "legal")?.links.map((l) => l.label)).toEqual([
      "Terms",
    ]);
  });

  it("drops the legal column when nothing in it can be linked", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "guest" },
      linkablePolicies: [],
    });
    expect(vm.columns.map((column) => column.id)).toEqual(["shop", "account"]);
  });

  it("orders shop, account, products, then the policies and lax.art's legal index", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [bid, art],
      accountState: { kind: "guest" },
      linkablePolicies: ALL_POLICIES,
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
    expect(vm.columns[0]?.links.slice(-3)).toEqual([
      { label: "Help and contact", href: "/help" },
      { label: "Returns and cancellation", href: "/returns" },
      { label: "Shipping and delivery", href: "/delivery" },
    ]);
    expect(vm.columns[3]?.links).toEqual([
      { label: "Legal and policies", href: "https://art.example/legal" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Cookies", href: "/cookies" },
    ]);
    const hrefs = vm.columns.flatMap((column) => column.links.map((link) => link.href));
    expect(hrefs.filter((href) => href.startsWith("https://bid.example/"))).toEqual([
      "https://bid.example/",
    ]);
  });

  it("keeps Shop policies without cross-product links, and drops the products column", () => {
    const vm = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "disabled", accountHref: "/account/disabled" },
      linkablePolicies: ALL_POLICIES,
    });
    expect(vm.columns.map((column) => column.id)).toEqual(["shop", "account", "legal"]);
    expect(vm.columns[2]?.links.map((link) => link.href)).toEqual([
      "/terms",
      "/privacy",
      "/cookies",
    ]);
    expect(vm.columns[1]?.links).toEqual([{ label: "Account status", href: "/account/disabled" }]);
  });

  it("links signed-in buyers to their orders and LAX Account, with no collection link", () => {
    const account = buildShopFooterVm({
      crossProductLinks: [],
      accountState: { kind: "authenticated" },
      linkablePolicies: ALL_POLICIES,
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
      linkablePolicies: ALL_POLICIES,
    }).columns[1];
    expect(account?.links).toEqual([]);
    expect(account?.note).toBe("Sign-in status unavailable");
  });
});
