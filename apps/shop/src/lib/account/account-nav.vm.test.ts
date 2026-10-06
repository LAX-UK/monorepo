import { describe, expect, it } from "vitest";
import { buildShopAccountNavItems } from "./account-nav.vm.js";

describe("buildShopAccountNavItems", () => {
  it("hides owner links when portal ownership is off", () => {
    const items = buildShopAccountNavItems({
      portalOwnershipEnabled: false,
      payoutsEnabled: false,
      activeHref: "/account/orders",
    });
    expect(items.map((i) => i.href)).toEqual(["/account", "/account/orders"]);
    expect(items.find((i) => i.href === "/account/orders")?.active).toBe(true);
  });

  it("includes payouts when enabled", () => {
    const items = buildShopAccountNavItems({
      portalOwnershipEnabled: true,
      payoutsEnabled: true,
      activeHref: "/account/payouts",
    });
    expect(items.some((i) => i.href === "/account/sales")).toBe(true);
    expect(items.some((i) => i.href === "/account/payouts")).toBe(true);
    expect(items.some((i) => i.href === "/account/documents")).toBe(true);
  });

  it("includes artist portal links when artist portal is enabled", () => {
    const items = buildShopAccountNavItems({
      portalOwnershipEnabled: true,
      payoutsEnabled: false,
      artistPortalEnabled: true,
      activeHref: "/account/artworks",
    });
    expect(items.map((i) => i.href)).toContain("/account/artworks");
    expect(items.map((i) => i.href)).toContain("/account/artist-sales");
    expect(items.find((i) => i.href === "/account/artworks")?.active).toBe(true);
  });
});
