import { describe, expect, it } from "vitest";
import { buildShopAccountNavItems } from "./account-nav.vm";
import { NO_SELLER_ACCESS, type ShopSellerAccess } from "./shop-seller-access";

const hrefs = (access: ShopSellerAccess) =>
  buildShopAccountNavItems({ access, activeHref: "/account/orders" }).map((item) => item.href);

describe("buildShopAccountNavItems", () => {
  it("gives a plain buyer no tabs: Your orders is the whole account area", () => {
    expect(hrefs(NO_SELLER_ACCESS)).toEqual([]);
  });

  it("never shows retired tabs, whatever the viewer's roles", () => {
    const all = hrefs({ seller: "yes", payee: "yes", artist: "yes" });
    for (const retired of ["/account", "/account/collection", "/account/enquiries"]) {
      expect(all).not.toContain(retired);
    }
    expect(all).not.toContain("/account/editions");
    expect(all).not.toContain("/account/documents");
  });

  it("shows sales and payouts to a payee", () => {
    expect(hrefs({ ...NO_SELLER_ACCESS, payee: "yes" })).toEqual([
      "/account/orders",
      "/account/sales",
      "/account/payouts",
    ]);
  });

  it("shows sale limits to a seller and the artist pages to a linked artist", () => {
    expect(hrefs({ ...NO_SELLER_ACCESS, seller: "yes" })).toEqual([
      "/account/orders",
      "/account/sale-limits",
    ]);
    expect(hrefs({ ...NO_SELLER_ACCESS, artist: "yes" })).toEqual([
      "/account/orders",
      "/account/artworks",
      "/account/artist-sales",
    ]);
  });

  it("hides a tool while its role lookup is unknown", () => {
    expect(hrefs({ seller: "unknown", payee: "unknown", artist: "unknown" })).toEqual([]);
  });

  it("marks the active tab", () => {
    const items = buildShopAccountNavItems({
      access: { ...NO_SELLER_ACCESS, payee: "yes" },
      activeHref: "/account/payouts",
    });
    expect(items.filter((item) => item.active).map((item) => item.label)).toEqual(["Payouts"]);
  });
});
